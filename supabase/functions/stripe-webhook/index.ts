// =============================================================================
// stripe-webhook , Supabase Edge Function
// =============================================================================
// Ontvangt Stripe-events en zet het tier/status in public.subscriptions.
// Wordt door Stripe (niet ingelogd) aangeroepen, dus deploy met --no-verify-jwt.
// De handtekening wordt geverifieerd met STRIPE_WEBHOOK_SECRET.
//
// Verwerkt:
//   checkout.session.completed          -> activeer abonnement
//   customer.subscription.updated       -> status/tier bijwerken
//   customer.subscription.deleted       -> terug naar free
//   customer.subscription.trial_will_end -> herinneringsmail naar de admins
//
// LET OP: trial_will_end moet aanstaan op het webhook-endpoint in Stripe,
// anders stuurt Stripe dit event nooit. Het vuurt 3 dagen voor het einde.
//
// Secrets:
//   STRIPE_SECRET_KEY       sk_...
//   STRIPE_WEBHOOK_SECRET   whsec_...
//   RESEND_API_KEY          re_...    (voor de trial-herinnering)
//   INVITE_FROM_EMAIL       "Kaspio <...>"
//   APP_URL                 https://kaspio.be
// Auto-aanwezig: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/** Map een Stripe price-id naar ons tier via de geconfigureerde price-secrets. */
function tierForPrice(priceId: string | undefined): "pro" | "team" | null {
  if (!priceId) return null;
  const map: Record<string, "pro" | "team"> = {};
  for (const [k, t] of [
    ["STRIPE_PRICE_PRO_MONTH", "pro"],
    ["STRIPE_PRICE_PRO_YEAR", "pro"],
    ["STRIPE_PRICE_TEAM_MONTH", "team"],
    ["STRIPE_PRICE_TEAM_YEAR", "team"],
  ] as const) {
    const v = Deno.env.get(k);
    if (v) map[v] = t;
  }
  return map[priceId] ?? null;
}

/**
 * Stripe kent meer subscription-statussen dan onze `sub_status` enum
 * ('active', 'trialing', 'past_due', 'canceled'). Zonder mapping faalt de
 * update met een enum-fout, geeft de webhook een 500 en blijft het tier hangen
 * op de oude waarde. Dat wordt echt bereikbaar zodra er proefperiodes zijn:
 * een kaart die weigert na de trial eindigt op 'unpaid'.
 */
function mapStatus(s: Stripe.Subscription.Status): "active" | "trialing" | "past_due" | "canceled" {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "incomplete":
      return "past_due";
    default:
      // canceled, unpaid, incomplete_expired, paused: geen toegang.
      return "canceled";
  }
}

async function upsertFromSubscription(subId: string, orgFromMeta?: string) {
  const sub = await stripe.subscriptions.retrieve(subId);
  const orgId =
    orgFromMeta ?? (sub.metadata?.organisation_id as string | undefined);
  if (!orgId) return;

  const priceId = sub.items.data[0]?.price?.id;
  const tier = tierForPrice(priceId) ?? "free";
  const active = sub.status === "active" || sub.status === "trialing";

  await admin
    .from("subscriptions")
    .update({
      tier: active ? tier : "free",
      status: mapStatus(sub.status),
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer as string,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", orgId);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Herinnering 3 dagen voor het einde van de proefperiode, naar alle admins van
 * de org. Dit is een facturatiemail, geen melding, dus we filteren niet op
 * notification_settings: wie de rekening krijgt, moet dit weten.
 */
async function sendTrialEndingEmail(sub: Stripe.Subscription) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;

  const orgId = sub.metadata?.organisation_id as string | undefined;
  if (!orgId || !sub.trial_end) return;

  const fromAddr = Deno.env.get("INVITE_FROM_EMAIL") ?? "Kaspio <onboarding@resend.dev>";
  const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";

  const { data: admins } = await admin
    .from("memberships").select("user_id")
    .eq("organisation_id", orgId).eq("role", "admin");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (ids.length === 0) return;

  const { data: profiles } = await admin
    .from("profiles").select("email").in("id", ids);
  const emails = (profiles ?? [])
    .map((p) => p.email)
    .filter((e): e is string => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (emails.length === 0) return;

  const { data: org } = await admin
    .from("organisations").select("name").eq("id", orgId).maybeSingle();
  const safeOrg = escapeHtml(org?.name ?? "je organisatie");

  // Onbekende price-id (niet in de env-map): dan liever geen plannaam dan de
  // verkeerde in een facturatiemail.
  const tier = tierForPrice(sub.items.data[0]?.price?.id);
  const planName = tier === "team" ? "Kaspio Team" : tier === "pro" ? "Kaspio Pro" : "Kaspio";

  const price = sub.items.data[0]?.price;
  const amount =
    price?.unit_amount != null
      ? (price.unit_amount / 100).toLocaleString("nl-BE", {
          style: "currency",
          currency: (price.currency ?? "eur").toUpperCase(),
        })
      : null;
  const per = price?.recurring?.interval === "year" ? "per jaar" : "per maand";
  const endDate = new Date(sub.trial_end * 1000).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const charge = amount
    ? `Op <strong>${endDate}</strong> rekenen we ${amount} ${per} aan.`
    : `Je proefperiode loopt af op <strong>${endDate}</strong>.`;

  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f7f9fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border:1px solid #e2e7ee;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#1e2a3a;">Je proefmaand loopt bijna af</h1>
      <p style="margin:0 0 16px;color:#455672;font-size:15px;line-height:1.5;">
        ${safeOrg} zit op ${planName}. ${charge}
        Je hoeft niets te doen, het loopt gewoon door. Wil je stoppen, zeg dan
        op vóór die datum in Instellingen, dan betaal je niks.
      </p>
      <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;">Abonnement bekijken</a>
      <p style="margin:18px 0 0;color:#95a3b6;font-size:12px;">Je krijgt deze mail als beheerder van ${safeOrg}.</p>
    </div>
  </div>
</body></html>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddr,
      to: emails,
      subject: `Je proefmaand van ${planName} loopt af op ${endDate}`,
      html,
    }),
  });
  if (!resp.ok) {
    // Niet doorwerpen: een mislukte mail mag de webhook geen 500 geven, want
    // dan blijft Stripe het hele event opnieuw aanbieden.
    console.error(`Resend status ${resp.status}`, await resp.text());
  }
}

Deno.serve(async (req: Request) => {
  const sig = req.headers.get("stripe-signature");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !whSecret) return new Response("Niet geconfigureerd", { status: 500 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      whSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response(`Webhook-fout: ${String(err)}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          await upsertFromSubscription(
            s.subscription as string,
            s.metadata?.organisation_id as string | undefined,
          );
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const s = event.data.object as Stripe.Subscription;
        if (event.type === "customer.subscription.deleted") {
          const orgId = s.metadata?.organisation_id as string | undefined;
          if (orgId) {
            await admin
              .from("subscriptions")
              .update({
                tier: "free",
                status: "canceled",
                updated_at: new Date().toISOString(),
              })
              .eq("organisation_id", orgId);
          }
        } else {
          await upsertFromSubscription(s.id, s.metadata?.organisation_id as string | undefined);
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        await sendTrialEndingEmail(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return new Response(`Verwerkingsfout: ${String(err)}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
