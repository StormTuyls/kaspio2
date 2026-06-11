// =============================================================================
// send-invite-email , Supabase Edge Function
// =============================================================================
// Verstuurt een uitnodigingsmail (met beta-code + signup-link) via Resend
// wanneer een admin iemand uitnodigt voor een organisatie.
//
// Wordt aangeroepen vanuit de frontend via supabase.functions.invoke(
//   "send-invite-email", { body: { email, betaCode, orgName, inviterName, role } }
// ). Edge Functions verifiëren standaard de JWT, dus alleen ingelogde users
// kunnen 'm aanroepen.
//
// Secrets (zet via dashboard of CLI, zie EMAIL_INVITES_SETUP.md):
//   RESEND_API_KEY     , verplicht. Je Resend API key (re_...).
//   INVITE_FROM_EMAIL  , optioneel. Afzender, bv. "Kaspio <noreply@kaspio.be>".
//                        Default: "Kaspio <onboarding@resend.dev>" (test-only).
//   APP_URL            , optioneel. Default "https://kaspio.be".
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  email?: string;
  betaCode?: string;
  orgName?: string;
  inviterName?: string;
  role?: string;
};

function roleLabel(role?: string): string {
  switch (role) {
    case "admin":
      return "beheerder";
    case "pot_owner":
      return "potjesbeheerder";
    case "reader":
      return "lezer";
    default:
      return "lid";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return json({ error: "RESEND_API_KEY niet geconfigureerd" }, 500);
    }

    const from =
      Deno.env.get("INVITE_FROM_EMAIL") ?? "Kaspio <onboarding@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") ?? "https://kaspio.be";

    const body = (await req.json()) as Payload;
    const email = (body.email ?? "").trim().toLowerCase();
    const betaCode = (body.betaCode ?? "").trim();
    const orgName = (body.orgName ?? "een organisatie").trim();
    const inviterName = (body.inviterName ?? "").trim();
    const role = body.role;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Ongeldig e-mailadres" }, 400);
    }

    const safeOrg = escapeHtml(orgName);
    const safeInviter = inviterName ? escapeHtml(inviterName) : "";
    const safeCode = escapeHtml(betaCode);
    const rol = roleLabel(role);

    const intro = safeInviter
      ? `${safeInviter} heeft je uitgenodigd voor <strong>${safeOrg}</strong> op Kaspio`
      : `Je bent uitgenodigd voor <strong>${safeOrg}</strong> op Kaspio`;

    const codeBlock = betaCode
      ? `
        <p style="margin:0 0 8px;color:#475672;font-size:14px;">Je hebt deze beta-code nodig om een account aan te maken:</p>
        <div style="margin:0 0 20px;padding:14px 18px;background:#E1F5EE;border-radius:10px;font-family:monospace;font-size:20px;font-weight:700;letter-spacing:2px;color:#0F6E56;text-align:center;">${safeCode}</div>`
      : "";

    const html = `<!doctype html>
<html lang="nl">
<body style="margin:0;background:#f7f9fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e2e7ee;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 6px;font-size:20px;color:#1e2a3a;">Welkom bij Kaspio</h1>
      <p style="margin:0 0 20px;color:#455672;font-size:15px;line-height:1.5;">
        ${intro} als <strong>${rol}</strong>.
      </p>
      ${codeBlock}
      <a href="${appUrl}" style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">
        Account aanmaken
      </a>
      <p style="margin:20px 0 0;color:#647691;font-size:13px;line-height:1.5;">
        Gebruik hetzelfde e-mailadres als waar je deze mail op kreeg, dan word je
        automatisch aan ${safeOrg} gekoppeld. Werkt de knop niet, ga dan naar
        <a href="${appUrl}" style="color:#168566;">${appUrl.replace(/^https?:\/\//, "")}</a>.
      </p>
    </div>
    <p style="margin:16px 0 0;text-align:center;color:#95a3b6;font-size:12px;">
      Kaspio , virtuele potjes op één bankrekening
    </p>
  </div>
</body>
</html>`;

    const subject = `Je bent uitgenodigd voor ${orgName} op Kaspio`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, html }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `Resend gaf status ${resp.status}`, detail }, 502);
    }

    const data = await resp.json();
    return json({ ok: true, id: data.id ?? null }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
