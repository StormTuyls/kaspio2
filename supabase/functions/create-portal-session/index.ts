// =============================================================================
// create-portal-session , Supabase Edge Function
// =============================================================================
// Opent de Stripe Billing Portal zodat een org-admin zijn abonnement zelf kan
// beheren (betaalmethode wijzigen, factuurgegevens, opzeggen). Geeft de
// portal-URL terug. Alleen een admin van de org met een bestaande
// stripe_customer_id mag dit. JWT-verificatie staat AAN.
//
// Aangeroepen via supabase.functions.invoke("create-portal-session",
//   { body: { orgId } }).
//
// Secrets:
//   STRIPE_SECRET_KEY   sk_...
//   APP_URL             https://kaspio.be (optioneel)
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

    const { orgId } = (await req.json()) as { orgId?: string };
    if (!orgId) return json({ error: "Ongeldige aanvraag" }, 400);

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

    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organisation_id", orgId)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return json({ error: "Nog geen betaalaccount voor deze org" }, 400);
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/?tab=settings`,
    });

    return json({ url: portal.url }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
