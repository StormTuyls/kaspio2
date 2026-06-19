// =============================================================================
// send-transaction-email , Supabase Edge Function
// =============================================================================
// Verstuurt een melding via Resend wanneer er een transactie aan een potje is
// toegevoegd. Ontvangers: de potverantwoordelijke(n) van dat potje + de
// admins van de org (de toevoeger zelf uitgezonderd).
//
// Aangeroepen vanuit de frontend via supabase.functions.invoke(
//   "send-transaction-email", { body: { orgId, potId, amount, direction,
//   occurredOn, counterparty } }). JWT-verificatie staat aan.
//
// Meldingen zijn een Pro+ feature: gratis orgs worden overgeslagen.
//
// Secrets (gedeeld met send-invite-email):
//   RESEND_API_KEY, INVITE_FROM_EMAIL (default onboarding@resend.dev), APP_URL.
// Auto-aanwezig: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function euro(cents: number): string {
  // amount komt binnen als getal in euro (geen cents); format met NL-komma.
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(cents);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "RESEND_API_KEY niet geconfigureerd" }, 500);
    const from =
      Deno.env.get("INVITE_FROM_EMAIL") ?? "Kaspio <onboarding@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";

    const body = (await req.json()) as {
      orgId?: string;
      potId?: string | null;
      amount?: number;
      direction?: "in" | "out";
      occurredOn?: string;
      counterparty?: string | null;
    };
    const orgId = body.orgId;
    if (!orgId) return json({ error: "orgId ontbreekt" }, 400);

    // Actor (degene die de transactie toevoegde) , uitsluiten van ontvangers.
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await asUser.auth.getUser();
    const actorId = user?.id ?? null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Meldingen zijn Pro+: gratis orgs overslaan.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("tier, status")
      .eq("organisation_id", orgId)
      .maybeSingle();
    const tier = sub && ["active", "trialing"].includes(sub.status) ? sub.tier : "free";
    if (tier === "free") return json({ ok: true, skipped: "free-tier" }, 200);

    // Ontvangers bepalen: potverantwoordelijke(n) van het potje + admins.
    const recipientIds = new Set<string>();
    if (body.potId) {
      const { data: owners } = await admin
        .from("memberships")
        .select("user_id")
        .eq("organisation_id", orgId)
        .eq("pot_id", body.potId)
        .eq("role", "pot_owner");
      for (const o of owners ?? []) recipientIds.add(o.user_id);
    }
    const { data: admins } = await admin
      .from("memberships")
      .select("user_id")
      .eq("organisation_id", orgId)
      .eq("role", "admin");
    for (const a of admins ?? []) recipientIds.add(a.user_id);
    if (actorId) recipientIds.delete(actorId);

    if (recipientIds.size === 0) return json({ ok: true, sent: 0 }, 200);

    const { data: profiles } = await admin
      .from("profiles")
      .select("email, full_name")
      .in("id", [...recipientIds]);
    const emails = (profiles ?? [])
      .map((p) => p.email)
      .filter((e): e is string => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (emails.length === 0) return json({ ok: true, sent: 0 }, 200);

    // Potnaam + org-naam.
    let potName = "een potje";
    if (body.potId) {
      const { data: pot } = await admin
        .from("pots")
        .select("name")
        .eq("id", body.potId)
        .maybeSingle();
      if (pot?.name) potName = pot.name;
    } else {
      potName = "Nog toe te wijzen";
    }
    const { data: org } = await admin
      .from("organisations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();

    const isIn = body.direction === "in";
    const amountStr = `${isIn ? "+" : "-"}${euro(Math.abs(body.amount ?? 0))}`;
    const safePot = escapeHtml(potName);
    const safeOrg = escapeHtml(org?.name ?? "je organisatie");
    const safeParty = body.counterparty ? escapeHtml(body.counterparty) : "";
    const accent = isIn ? "#059669" : "#e11d48";

    const subject = `${amountStr} in ${potName} , ${org?.name ?? "Kaspio"}`;
    const html = `<!doctype html>
<html lang="nl"><body style="margin:0;background:#f7f9fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border:1px solid #e2e7ee;border-radius:16px;padding:28px;">
      <p style="margin:0 0 6px;color:#647691;font-size:13px;">${safeOrg}</p>
      <h1 style="margin:0 0 14px;font-size:18px;color:#1e2a3a;">Nieuwe transactie in ${safePot}</h1>
      <div style="font-size:28px;font-weight:800;color:${accent};margin:0 0 16px;">${escapeHtml(amountStr)}</div>
      ${safeParty ? `<p style="margin:0 0 4px;color:#455672;font-size:14px;">${isIn ? "Van" : "Aan"}: ${safeParty}</p>` : ""}
      <a href="${escapeHtml(appUrl)}" style="display:inline-block;margin-top:12px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;">Bekijk in Kaspio</a>
      <p style="margin:18px 0 0;color:#95a3b6;font-size:12px;">Je krijgt deze mail omdat je beheerder of potverantwoordelijke bent. Pas meldingen aan in Instellingen.</p>
    </div>
  </div>
</body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: emails, subject, html }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `Resend status ${resp.status}`, detail }, 502);
    }
    return json({ ok: true, sent: emails.length }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
