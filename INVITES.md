# Kaspio invite codes (admin gids)

> Hoe je beta-toegang verleent aan waitlist-leden zonder de signup open te stellen voor iedereen.

---

## Hoe het werkt

1. Bezoeker schrijft zich in op de wachtlijst (MailerLite)
2. Jij krijgt notificatie + besluit of die persoon in de eerste beta-batch hoort
3. Jij genereert een invite code in Supabase
4. Jij mailt vanuit Gmail die code + de signup-URL
5. Persoon klikt URL → vult invite code in bij signup → account aangemaakt
6. Niemand zonder code kan een account maken

---

## Eenmalige setup

Run `supabase/invite-codes.sql` in je Supabase SQL Editor. Dit voegt toe:

- `invite_codes` tabel (gesloten met RLS, geen directe client-toegang)
- `consume_invite(p_code, p_email)` RPC (gebruikt door signup form)
- `create_invite(p_email, p_note, p_max_uses, p_expires_at)` helper-functie

Verificatie:

```sql
select count(*) from public.invite_codes;
-- Moet 0 zijn (lege tabel)

select public.consume_invite('NIET-BESTAAND', 'a@b.com');
-- Moet 'not_found' geven
```

---

## Een code genereren

Open Supabase → SQL Editor → New query. Twee opties:

### Optie A: Eenmalige code gebonden aan één e-mail (aanrader)

```sql
select public.create_invite(
  p_email := 'jan.dewolf@gmail.com',
  p_note := 'Penningmeester Scouts Berchem, interview gepland 5 juni'
);
```

Output:

```
create_invite
─────────────
KASP-7F3A2B
```

Deze code:
- Werkt alleen voor `jan.dewolf@gmail.com`
- Mag éénmaal gebruikt worden
- Verloopt nooit (tenzij je `p_expires_at` zet)

### Optie B: Generieke code voor meerdere mensen

```sql
select public.create_invite(
  p_email := null,
  p_note := 'LinkedIn-post 26 mei batch',
  p_max_uses := 10
);
```

Deze code werkt voor elke e-mail, 10 mensen kunnen 'm gebruiken. Handig voor publieke beta-rondes.

### Optie C: Tijdelijke code

```sql
select public.create_invite(
  p_email := null,
  p_note := 'Conferentie demo',
  p_max_uses := 50,
  p_expires_at := now() + interval '7 days'
);
```

50 toelatingen, geldig één week.

---

## Code versturen

Vanuit Gmail, persoonlijk:

```
Onderwerp: Welkom bij de Kaspio gesloten beta

Hoi [voornaam],

Bedankt voor je inschrijving op de wachtlijst. Je hoort tot de
eerste lichting beta-testers.

Maak je account aan via deze link:
https://kaspio.be/  (klik "Aanmelden" rechtsboven)

Je invite code: KASP-7F3A2B

(belangrijk: gebruik exact het e-mailadres waarmee je je hebt
ingeschreven, anders accepteert het systeem de code niet.)

Eén ding ik vraag: 20 minuten van je tijd voor een gesprek over
hoe jullie vandaag potjes beheren. Hier kun je een moment kiezen:
[Calendly link]

Tot binnenkort,
Storm
```

---

## Beheren

### Alle codes bekijken

```sql
select
  code,
  email,
  uses || '/' || max_uses as gebruikt,
  expires_at,
  note,
  created_at
from public.invite_codes
order by created_at desc;
```

### Wie heeft welke code gebruikt? (via audit-spoor)

De `uses` kolom telt op, maar koppelt niet aan een user. Wil je weten wie wel/niet signupte na een code te krijgen, zoek in `auth.users`:

```sql
select c.code, c.email, c.uses, u.email as user_email, u.created_at
from public.invite_codes c
left join auth.users u on lower(u.email) = lower(c.email)
order by c.created_at desc;
```

### Een code intrekken

```sql
delete from public.invite_codes where code = 'KASP-7F3A2B';
-- Of: max_uses op 0 zetten zodat verdere pogingen falen
update public.invite_codes set max_uses = 0 where code = 'KASP-7F3A2B';
```

### Iemand die zijn code kwijt is

```sql
-- Zoek de oude code voor die persoon
select * from public.invite_codes where email = 'jan.dewolf@gmail.com';

-- Maak een verse code aan (de oude blijft technisch werken tenzij je hem deletet)
select public.create_invite(p_email := 'jan.dewolf@gmail.com', p_note := 'Nieuw verstuurd 27 mei');
```

---

## Workflow voorbeeld: één persoon onboarden

1. Krijg notificatie: `someone@gmail.com` heeft zich ingeschreven op wachtlijst
2. Open Supabase SQL Editor, run:
   ```sql
   select public.create_invite(p_email := 'someone@gmail.com', p_note := 'Penningmeester X, scouts Y');
   ```
3. Kopieer de code uit het resultaat (bv. `KASP-A4B2C9`)
4. Open Gmail, mail naar `someone@gmail.com`:
   - Welkom-tekst
   - Code
   - Signup URL
   - Calendly link voor interview
5. Klaar. Persoon kan binnen 30 sec een account maken.

---

## Tips

- **Houd `note` invullen consistent.** Bv: "Naam · Organisatie · Bron". Maakt het later makkelijk om je beta-cohort te analyseren.
- **Genereer codes pas wanneer je iemand wil uitnodigen.** Niet preventief — anders raak je het overzicht kwijt.
- **Persoonlijke codes (met email) > generieke codes.** Voorkomt dat één persoon de code deelt en je beta verzadigd raakt.
- **Maak een aparte code voor jezelf** om de signup-flow te testen voor je echte mensen uitnodigt.
