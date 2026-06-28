// =============================================================================
// send-digest , Supabase Edge Function (geplande job)
// =============================================================================
// Stuurt een periodieke samenvatting (dagelijks/wekelijks) naar gebruikers die
// dat in hun voorkeuren hebben gezet. Wordt door een cron aangeroepen (zie
// supabase/digest-cron.sql), NIET door gebruikers.
//
// Beveiliging: deploy met --no-verify-jwt en zet DIGEST_SECRET; de cron stuurt
// die mee als header x-digest-secret.
//
// Body: { period: "daily" | "weekly" }
// Secrets: RESEND_API_KEY, INVITE_FROM_EMAIL, APP_URL, DIGEST_SECRET.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function euro(n: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

Deno.serve(async (req: Request) => {
  try {
    // Beveiliging: DIGEST_SECRET is verplicht. Ontbreekt hij, dan weigeren we
    // (fail closed) i.p.v. de check over te slaan: deze functie draait no-verify-jwt.
    const secret = Deno.env.get("DIGEST_SECRET");
    if (!secret || req.headers.get("x-digest-secret") !== secret) {
      return new Response("forbidden", { status: 403 });
    }
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return new Response("no resend key", { status: 500 });
    const from = Deno.env.get("INVITE_FROM_EMAIL") ?? "Kaspio <onboarding@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";

    const { period } = (await req.json().catch(() => ({}))) as {
      period?: "daily" | "weekly";
    };
    const days = period === "weekly" ? 7 : 1;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // sinds-datum (YYYY-MM-DD), `days` terug.
    const since = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);

    // Wie wil deze digest?
    const { data: subs } = await admin
      .from("notification_settings")
      .select("user_id")
      .eq("digest_frequency", period === "weekly" ? "weekly" : "daily");
    const userIds = (subs ?? []).map((s) => s.user_id);
    if (userIds.length === 0) return Response.json({ ok: true, sent: 0 });

    // Pro+ orgs (gratis orgs niet meenemen in digests).
    const { data: paidSubs } = await admin
      .from("subscriptions")
      .select("organisation_id, tier, status");
    const paidOrgs = new Set(
      (paidSubs ?? [])
        .filter((s) => ["active", "trialing"].includes(s.status) && s.tier !== "free")
        .map((s) => s.organisation_id),
    );

    let sent = 0;
    for (const uid of userIds) {
      const { data: profile } = await admin
        .from("profiles").select("email, full_name").eq("id", uid).maybeSingle();
      const email = profile?.email;
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;

      const { data: mems } = await admin
        .from("memberships").select("organisation_id").eq("user_id", uid);
      const orgIds = [...new Set((mems ?? []).map((m) => m.organisation_id))].filter((o) =>
        paidOrgs.has(o),
      );
      if (orgIds.length === 0) continue;

      const lines: string[] = [];
      for (const orgId of orgIds) {
        const { data: txns } = await admin
          .from("transactions")
          .select("amount, direction, status")
          .eq("organisation_id", orgId)
          .gte("occurred_on", since);
        const approved = (txns ?? []).filter((t) => t.status !== "pending");
        if (approved.length === 0) continue;
        const totIn = approved.filter((t) => t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
        const totOut = approved.filter((t) => t.direction === "out").reduce((s, t) => s + Number(t.amount), 0);
        const { data: org } = await admin
          .from("organisations").select("name").eq("id", orgId).maybeSingle();
        lines.push(
          `<tr><td style="padding:6px 0;">${escapeHtml(org?.name ?? "Organisatie")}</td>
           <td style="padding:6px 0;text-align:right;color:#059669;">+${euro(totIn)}</td>
           <td style="padding:6px 0;text-align:right;color:#e11d48;">-${euro(totOut)}</td>
           <td style="padding:6px 0;text-align:right;color:#6b7280;">${approved.length}</td></tr>`,
        );
      }
      if (lines.length === 0) continue;

      const periodLabel = period === "weekly" ? "deze week" : "vandaag";
      const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f7f9fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
        <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
          <div style="background:#fff;border:1px solid #e2e7ee;border-radius:16px;padding:28px;">
            <h1 style="margin:0 0 4px;font-size:18px;color:#1e2a3a;">Je Kaspio-samenvatting</h1>
            <p style="margin:0 0 18px;color:#647691;font-size:13px;">Activiteit ${periodLabel}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="border-bottom:2px solid #1a1a18;font-size:11px;text-transform:uppercase;color:#6b7280;">
                <th style="text-align:left;padding:6px 0;">Org</th>
                <th style="text-align:right;padding:6px 0;">In</th>
                <th style="text-align:right;padding:6px 0;">Uit</th>
                <th style="text-align:right;padding:6px 0;"># </th>
              </tr></thead>
              <tbody>${lines.join("")}</tbody>
            </table>
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;margin-top:18px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;">Open Kaspio</a>
            <p style="margin:18px 0 0;color:#95a3b6;font-size:12px;">Pas je samenvatting aan in Instellingen.</p>
          </div>
        </div></body></html>`;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject: "Je Kaspio-samenvatting", html }),
      });
      if (resp.ok) sent++;
    }

    return Response.json({ ok: true, sent });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
