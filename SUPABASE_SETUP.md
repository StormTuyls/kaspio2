# Supabase Setup voor Kaspio

> Eenmalige setup, kost je ~15 minuten. Je hoeft geen creditcard achter te
> laten zolang je op het free plan blijft.

---

## Stap 1. Account aanmaken

1. Ga naar [supabase.com](https://supabase.com) en klik **Start your project**
2. Sign up met GitHub (snelste) of e-mail
3. Bevestig je e-mail als nodig

---

## Stap 2. Nieuw project aanmaken

1. Klik **New project**
2. Vul in:

   | Veld | Waarde |
   |---|---|
   | **Name** | `kaspio` |
   | **Database Password** | Genereer een sterk wachtwoord (kopieer naar je wachtwoordmanager, je gaat dit zelden nodig hebben maar verlies het niet) |
   | **Region** | **Frankfurt (eu-central-1)** ⚠️ kies expliciet deze, voor GDPR-compliance |
   | **Pricing Plan** | **Free** |

3. Klik **Create new project**. Wachten duurt ~2 minuten. Supabase provisioneert ondertussen je Postgres-DB, auth-service, en API.

---

## Stap 3. Schema laden

1. Open in de linker sidebar **SQL Editor** (icoontje met `</>`)
2. Klik **New query** rechtsboven
3. Open lokaal het bestand [`supabase/schema.sql`](supabase/schema.sql) en kopieer **de volledige inhoud**
4. Plak in de SQL Editor
5. Klik **Run** (of `Cmd+Enter` / `Ctrl+Enter`)
6. Onderaan moet er staan **Success. No rows returned**

Verificatie, klik **New query**, plak dit en run:

```sql
select count(*) from pg_policies where schemaname = 'public';
```

Resultaat moet **20 of meer** zijn. Als je 0 ziet, is het schema niet geladen, herhaal stap 3.

---

## Stap 4. Auth-instellingen

In de sidebar → **Authentication** → **Providers** → **Email**

- ✅ **Enable Email provider**, staat default aan
- ✅ **Confirm email**, laat aanstaan (voor productie). Tijdens dev mag je tijdelijk uit zetten voor sneller testen, maar zet hem **aan vóór go-live**.
- ✅ **Secure password change**, aan

Onder **Email Templates** kun je later de templates (verificatiemail, magic link mail, reset mail) aanpassen naar Kaspio's tone-of-voice. Voor nu zijn de defaults OK.

In **URL Configuration**:

- **Site URL**: `http://localhost:5180` (dev), later wijzigen naar `https://kaspio.be`
- **Redirect URLs** (één per regel):
  ```
  http://localhost:5180/**
  https://kaspio.be/**
  https://kaspio-*.vercel.app/**
  ```

---

## Stap 5. API keys kopiëren

In de sidebar → **Project Settings** (tandwiel onderaan) → **API**

Je ziet drie waarden:

| Wat | Wat doe je ermee |
|---|---|
| **Project URL** (`https://xxx.supabase.co`) | Kopieer → `VITE_SUPABASE_URL` |
| **anon public** key (lange JWT) | Kopieer → `VITE_SUPABASE_ANON_KEY` |
| **service_role** key | ⚠️ **NIET in frontend gebruiken!** Enkel voor server-side admin scripts. Laat staan voor nu. |

---

## Stap 6. Env vars zetten

### Lokaal (`.env.local`)

Maak een bestand `.env.local` in de root van het project:

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

⚠️ **Niet committen.** Het bestand staat al in `.gitignore` (zo niet, voeg ik toe in de volgende sessie).

### Vercel (productie)

1. Vercel dashboard → je project → **Settings** → **Environment Variables**
2. Twee variabelen toevoegen:
   - `VITE_SUPABASE_URL` = jouw project URL
   - `VITE_SUPABASE_ANON_KEY` = jouw anon key
3. Selecteer voor beide **Production**, **Preview**, en **Development** (vinkjes)
4. Klik **Save**
5. Trigger een nieuwe deploy zodat ze actief worden:
   - Vercel dashboard → **Deployments** → laatste deploy → drie puntjes → **Redeploy**

---

## Stap 7. Verificatie

Open de SQL Editor opnieuw en run:

```sql
-- Maak een test-user via de Auth-UI (niet hier in SQL)
-- Dashboard → Authentication → Users → Add user → "Send invite"
-- Stuur naar je eigen e-mail. Klik op de link in de mail.

-- Daarna hier checken:
select id, email, full_name, created_at from public.profiles;
```

Je zou nu **1 rij** moeten zien, jouw test-user. Dat bewijst dat:
- ✅ Auth werkt
- ✅ De trigger `on_auth_user_created` werkt
- ✅ De `profiles` tabel wordt automatisch gevuld

Als dit OK is, ben je klaar. Laat me weten in de volgende sessie en ik wire de frontend aan.

---

## Troubleshooting

**"permission denied for table profiles"** bij eerste insert
→ Je bent niet ingelogd via Supabase Auth. Test eerst via de Authentication-UI in het dashboard, niet via SQL.

**Project blijft "Pausing" of "Restoring"**
→ Free-tier projecten pauzeren na 1 week inactiviteit. Klik gewoon **Restore** in het dashboard. Data blijft intact.

**"row violates row-level security policy"**
→ Bedoeld gedrag. Het betekent dat je probeert iets te lezen/schrijven waar je geen rechten voor hebt. Tijdens dev kun je tijdelijk in de SQL Editor draaien (die heeft service_role rechten) om data te seeden of debuggen.

**SQL editor zegt "syntax error" bij het runnen van schema.sql**
→ Plak het volledige bestand in één keer (niet stuk per stuk). De `create type` en `create function` statements hebben context nodig.

---

## Wat de volgende sessie gebeurt

Wanneer je het bovenstaande hebt afgewerkt, breng ik in de volgende sessie:

1. **`src/supabase.ts`**. Supabase client wrapper met types
2. **`src/auth.ts`**, vervangen door Supabase Auth (email/password + magic link)
3. **`src/storage.ts`**, vervangen door Supabase queries met RLS
4. **AuthView**, nieuwe signup-form (e-mail + naam + organisatienaam)
5. **`server/` map verwijderen**, niet meer nodig
6. **Migratie van bestaande localStorage data** (optioneel, voor je eigen test-data)

Schrijf je e-mail-adres en het test-account-wachtwoord ergens op, daar gaan we mee testen.
