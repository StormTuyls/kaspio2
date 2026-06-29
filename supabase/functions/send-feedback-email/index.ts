// =============================================================================
// send-feedback-email , Supabase Edge Function
// =============================================================================
// Stuurt een mail naar de operator wanneer een gebruiker in-app feedback geeft
// (bug / idee / andere). De feedback zelf is al opgeslagen in public.feedback;
// deze mail is best-effort zodat je het meteen ziet.
//
// Aangeroepen via supabase.functions.invoke("send-feedback-email", {
//   body: { kind, message, context, orgId } }).
//
// Secrets: RESEND_API_KEY, INVITE_FROM_EMAIL (afzender), APP_URL,
//          FEEDBACK_TO (ontvanger; ontbreekt hij, dan slaan we de mail over).
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

const KIND_LABEL: Record<string, string> = {
  bug: "Bug",
  idea: "Idee / feature",
  other: "Andere",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const to = Deno.env.get("FEEDBACK_TO");
    const fromAddr = Deno.env.get("INVITE_FROM_EMAIL") ?? "Kaspio <onboarding@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";
    // Zonder ontvanger of API-key: niets te mailen (feedback staat al in de DB).
    if (!apiKey || !to) return json({ ok: true, skipped: "no-recipient" }, 200);

    const body = (await req.json()) as {
      kind?: string;
      message?: string;
      context?: Record<string, unknown>;
      orgId?: string;
    };
    const kind = body.kind && body.kind in KIND_LABEL ? body.kind : "other";
    const message = (body.message ?? "").trim();
    if (!message) return json({ error: "Lege feedback" }, 400);

    // Afzender achterhalen via het meegestuurde sessietoken (best-effort).
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let who = user?.email ?? "onbekende gebruiker";
    if (user?.id) {
      const { data: me } = await admin
        .from("profiles").select("email, full_name").eq("id", user.id).maybeSingle();
      if (me?.full_name) who = `${me.full_name} (${me.email ?? who})`;
    }

    let orgName = "";
    if (body.orgId) {
      const { data: org } = await admin
        .from("organisations").select("name").eq("id", body.orgId).maybeSingle();
      orgName = org?.name ?? "";
    }

    const ctx = body.context ?? {};
    const ctxRows = Object.entries(ctx)
      .map(([k, v]) =>
        `<tr><td style="padding:2px 10px 2px 0;color:#95a3b6;">${escapeHtml(k)}</td><td style="color:#455672;">${escapeHtml(String(v))}</td></tr>`,
      )
      .join("");

    const label = KIND_LABEL[kind];
    const subject = `[Kaspio feedback] ${label}: ${message.slice(0, 60)}`;
    const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f7f9fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border:1px solid #e2e7ee;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:18px;color:#1e2a3a;">Nieuwe feedback: ${escapeHtml(label)}</h1>
      <p style="margin:0 0 16px;color:#95a3b6;font-size:13px;">van ${escapeHtml(who)}${orgName ? ` , ${escapeHtml(orgName)}` : ""}</p>
      <div style="background:#f7f9fc;border-radius:10px;padding:14px 16px;color:#1e2a3a;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(message)}</div>
      <table style="margin-top:16px;font-size:12px;border-collapse:collapse;">${ctxRows}</table>
      <p style="margin:18px 0 0;"><a href="${escapeHtml(appUrl)}" style="color:#4f46e5;font-size:13px;">Open Kaspio</a></p>
    </div>
  </div>
</body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddr, to: [to], subject, html }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `Resend status ${resp.status}`, detail }, 502);
    }
    return json({ ok: true }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
