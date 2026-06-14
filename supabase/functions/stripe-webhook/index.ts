// =============================================================================
// stripe-webhook , Supabase Edge Function
// =============================================================================
// Ontvangt Stripe-events en zet het tier/status in public.subscriptions.
// Wordt door Stripe (niet ingelogd) aangeroepen, dus deploy met --no-verify-jwt.
// De handtekening wordt geverifieerd met STRIPE_WEBHOOK_SECRET.
//
// Verwerkt:
//   checkout.session.completed        -> activeer abonnement
//   customer.subscription.updated     -> status/tier bijwerken
//   customer.subscription.deleted     -> terug naar free
//
// Secrets:
//   STRIPE_SECRET_KEY       sk_...
//   STRIPE_WEBHOOK_SECRET   whsec_...
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
      status: sub.status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer as string,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", orgId);
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
