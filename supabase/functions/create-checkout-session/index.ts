// =============================================================================
// create-checkout-session , Supabase Edge Function
// =============================================================================
// Maakt een Stripe Checkout-sessie voor een org-upgrade (Pro/Team, maand/jaar)
// en geeft de checkout-URL terug. Alleen een admin van de org mag dit.
//
// Aangeroepen vanuit de frontend via supabase.functions.invoke(
//   "create-checkout-session", { body: { orgId, tier, interval } }).
// JWT-verificatie staat AAN (alleen ingelogde users).
//
// Secrets (zie supabase/STRIPE_SETUP.md):
//   STRIPE_SECRET_KEY            sk_...
//   STRIPE_PRICE_PRO_MONTH       price_...
//   STRIPE_PRICE_PRO_YEAR        price_...
//   STRIPE_PRICE_TEAM_MONTH      price_...
//   STRIPE_PRICE_TEAM_YEAR       price_...
//   APP_URL                      https://kaspio.be (optioneel, default kaspio.be)
// Auto-aanwezig: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json({ error: "Stripe niet geconfigureerd" }, 500);

    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";

    const { orgId, tier, interval } = (await req.json()) as {
      orgId?: string;
      tier?: "pro" | "team";
      interval?: "month" | "year";
    };
    if (!orgId || (tier !== "pro" && tier !== "team")) {
      return json({ error: "Ongeldige aanvraag" }, 400);
    }
    const iv = interval === "year" ? "year" : "month";

    const priceKey = `STRIPE_PRICE_${tier.toUpperCase()}_${iv === "year" ? "YEAR" : "MONTH"}`;
    const priceId = Deno.env.get(priceKey);
    if (!priceId) return json({ error: `Prijs niet geconfigureerd (${priceKey})` }, 500);

    // Wie roept aan? (JWT uit de Authorization header)
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await asUser.auth.getUser();
    if (!user) return json({ error: "Niet ingelogd" }, 401);

    // Service role voor membership-check + subscriptions
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: membership } = await admin
      .from("memberships")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!membership) return json({ error: "Geen beheerder van deze org" }, 403);

    // Bestaande Stripe-customer hergebruiken of aanmaken
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organisation_id", orgId)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { organisation_id: orgId },
      });
      customerId = customer.id;
      await admin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("organisation_id", orgId);
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?upgrade=success`,
      cancel_url: `${appUrl}/?upgrade=cancel`,
      metadata: { organisation_id: orgId, tier },
      subscription_data: { metadata: { organisation_id: orgId, tier } },
      allow_promotion_codes: true,
    });

    return json({ url: checkout.url }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
