# Echte e-mail invites , setup

Wanneer een admin iemand uitnodigt, stuurt Kaspio automatisch een mail met de
beta-code + signup-link. Dit draait op een **Supabase Edge Function** die
**Resend** gebruikt als mailprovider.

**Belangrijk:** dit is additief. Werkt de mail niet (Resend nog niet ingesteld,
functie niet gedeployed), dan blijft de oude flow gewoon werken: de admin krijgt
de code in de UI en kan 'm zelf doorsturen. Je kan dus live gaan zonder dit, en
het later aanzetten.

Tijd: 20-30 min (waarvan ~10 min wachten op DNS).

---

## Stap 1: Resend-account + API key

1. Maak gratis account op [resend.com](https://resend.com) (3000 mails/maand, 100/dag gratis)
2. Ga naar **API Keys** -> **Create API Key**
3. Naam: `kaspio-invites`, permissie: **Sending access**
4. Kopieer de key (begint met `re_...`). Je ziet 'm maar 1 keer, bewaar 'm even.

## Stap 2: Domein verifiëren (kaspio.be)

Zonder geverifieerd domein mag Resend alleen mailen naar je eigen account-adres,
vanaf `onboarding@resend.dev`. Voor echte invites moet je kaspio.be verifiëren.

1. In Resend: **Domains** -> **Add Domain** -> vul `kaspio.be` in
2. Resend toont een lijstje DNS-records (MX, TXT voor SPF, TXT voor DKIM)
3. Ga naar je DNS-beheer (waar kaspio.be gehost wordt, bv. Vercel of je registrar)
4. Voeg elk record toe exact zoals Resend toont
5. Terug in Resend: klik **Verify**. DNS-propagatie duurt 5-30 min.
6. Zodra "Verified": je kan mailen vanaf bv. `noreply@kaspio.be`

> Tijdelijk testen zonder domein? Sla deze stap over en gebruik in stap 4
> `INVITE_FROM_EMAIL = Kaspio <onboarding@resend.dev>`. Dan kan je enkel naar je
> eigen Resend-account-mailadres sturen. Goed genoeg om de flow te testen.

## Stap 3: Edge Function deployen

De functiecode staat in `supabase/functions/send-invite-email/index.ts`.

### Optie A , via Supabase Dashboard (geen CLI nodig, aanbevolen voor jou)

1. Supabase dashboard -> je project -> **Edge Functions** (linker menu)
2. **Deploy a new function** -> **Via Editor**
3. Naam: `send-invite-email` (exact deze naam, anders vindt de frontend 'm niet)
4. Open `supabase/functions/send-invite-email/index.ts` in je IDE, kopieer ALLE inhoud
5. Plak in de dashboard-editor, vervang de boilerplate
6. **Deploy**

### Optie B , via Supabase CLI

```bash
# eenmalig: CLI installeren + inloggen + project linken
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <jouw-project-ref>   # ref staat in dashboard URL

# deploy
supabase functions deploy send-invite-email
```

## Stap 4: Secrets instellen

De functie leest 3 environment variables. Zet ze als Supabase secrets.

### Via dashboard

Edge Functions -> **Manage secrets** (of Project Settings -> Edge Functions) ->
voeg toe:

| Naam | Waarde | Verplicht |
|------|--------|-----------|
| `RESEND_API_KEY` | je key uit stap 1 (`re_...`) | ja |
| `INVITE_FROM_EMAIL` | `Kaspio <noreply@kaspio.be>` (of `onboarding@resend.dev` voor test) | nee |
| `APP_URL` | `https://kaspio.be` | nee |

### Via CLI

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set "INVITE_FROM_EMAIL=Kaspio <noreply@kaspio.be>"
supabase secrets set APP_URL=https://kaspio.be
```

> Na het zetten van secrets via dashboard: de functie pakt ze direct op. Via CLI:
> idem, geen redeploy nodig.

## Stap 5: Testen

1. Log in op kaspio.be als admin
2. Ga naar **Leden** -> **Lid uitnodigen**
3. Nodig een testadres uit (bij test-mode: je eigen Resend-account-mail)
4. In de UI zou je nu moeten zien: **"Uitnodigingsmail verstuurd naar X"**
   in plaats van "Kopieer mail-template"
5. Check de inbox van het testadres

### Werkt het niet?

- **UI zegt nog steeds "Kopieer mail-template"** -> de functie gaf geen `ok`.
  Open de browser-console (F12), zoek naar `[Kaspio]` warnings. Mogelijke oorzaken:
  - Functie niet gedeployed onder exact de naam `send-invite-email`
  - `RESEND_API_KEY` niet gezet
- **Functie-logs bekijken:** dashboard -> Edge Functions -> `send-invite-email`
  -> **Logs**. Daar zie je de echte foutmelding van Resend (bv. "domain not
  verified" of "you can only send to your own email").
- **"domain not verified"** -> stap 2 nog niet af, of gebruik tijdelijk
  `onboarding@resend.dev` als afzender.

---

## Hoe het samenhangt met de bestaande flow

```
Admin klikt "uitnodigen"
   -> create_org_invite RPC      (org_invites rij)
   -> create_invite RPC          (beta-code gegenereerd)
   -> supabase.functions.invoke("send-invite-email")   <- NIEUW
        -> Resend stuurt mail met code + link
   -> UI toont "mail verstuurd" (of valt terug op manuele code)

Uitgenodigde maakt account met dezelfde mail + code
   -> bij login: accept_pending_invites RPC koppelt hen automatisch aan de org
```

De beta-code blijft de toegangspoort (closed beta). De mail bevat 'm gewoon
automatisch, zodat jij niet meer handmatig hoeft te kopiëren.
