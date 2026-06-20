// =============================================================================
// send-org-event-email , Supabase Edge Function
// =============================================================================
// Meldingen voor org-gebeurtenissen (Pro+): een nieuw potje of een nieuw lid.
// Ontvangers = de admins van de org (de actor zelf uitgezonderd).
//
// Aangeroepen via supabase.functions.invoke("send-org-event-email", {
//   body: { orgId, event: "pot_created" | "member_added", potName? } }).
//
// Secrets (gedeeld): RESEND_API_KEY, INVITE_FROM_EMAIL, APP_URL.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(p: unknown, s: number): Response {
  return new Response(JSON.stringify(p), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "RESEND_API_KEY niet geconfigureerd" }, 500);
    const fromAddr = Deno.env.get("INVITE_FROM_EMAIL") ?? "Kaspio <onboarding@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";

    const { orgId, event, potName } = (await req.json()) as {
      orgId?: string;
      event?: "pot_created" | "member_added";
      potName?: string;
    };
    if (!orgId || (event !== "pot_created" && event !== "member_added")) {
      return json({ error: "Ongeldige aanvraag" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    const actorId = user?.id ?? null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Meldingen zijn Pro+.
    const { data: sub } = await admin
      .from("subscriptions").select("tier, status")
      .eq("organisation_id", orgId).maybeSingle();
    const tier = sub && ["active", "trialing"].includes(sub.status) ? sub.tier : "free";
    if (tier === "free") return json({ ok: true, skipped: "free-tier" }, 200);

    // Ontvangers = admins, actor uitgezonderd.
    const { data: admins } = await admin
      .from("memberships").select("user_id")
      .eq("organisation_id", orgId).eq("role", "admin");
    const ids = new Set((admins ?? []).map((a) => a.user_id));
    if (actorId) ids.delete(actorId);
    if (ids.size === 0) return json({ ok: true, sent: 0 }, 200);

    const { data: profiles } = await admin
      .from("profiles").select("email, full_name").in("id", [...ids]);
    const emails = (profiles ?? [])
      .map((p) => p.email)
      .filter((e): e is string => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (emails.length === 0) return json({ ok: true, sent: 0 }, 200);

    const { data: org } = await admin
      .from("organisations").select("name").eq("id", orgId).maybeSingle();
    const safeOrg = escapeHtml(org?.name ?? "je organisatie");

    let actorName = "Iemand";
    if (actorId) {
      const { data: me } = await admin
        .from("profiles").select("full_name").eq("id", actorId).maybeSingle();
      if (me?.full_name) actorName = me.full_name;
    }

    let heading: string;
    let line: string;
    if (event === "pot_created") {
      heading = `Nieuw potje in ${safeOrg}`;
      line = `${escapeHtml(actorName)} maakte het potje <strong>${escapeHtml(potName ?? "een potje")}</strong> aan.`;
    } else {
      heading = `Nieuw lid in ${safeOrg}`;
      line = `<strong>${escapeHtml(actorName)}</strong> is lid geworden van de organisatie.`;
    }
    const subject =
      event === "pot_created"
        ? `Nieuw potje in ${org?.name ?? "Kaspio"}`
        : `Nieuw lid in ${org?.name ?? "Kaspio"}`;

    const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f7f9fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border:1px solid #e2e7ee;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#1e2a3a;">${heading}</h1>
      <p style="margin:0 0 16px;color:#455672;font-size:15px;line-height:1.5;">${line}</p>
      <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;">Bekijk in Kaspio</a>
      <p style="margin:18px 0 0;color:#95a3b6;font-size:12px;">Je krijgt deze mail als beheerder. Pas meldingen aan in Instellingen.</p>
    </div>
  </div>
</body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddr, to: emails, subject, html }),
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
