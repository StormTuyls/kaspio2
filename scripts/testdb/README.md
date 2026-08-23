# Testdatabase

Een lokale databank met het volledige Kaspio-schema, zodat je migraties,
constraints en RLS kan uitproberen zonder productie aan te raken.

```bash
./scripts/testdb/testdb.sh up
```

Dat zet een Postgres op poort 55433 neer, laadt alle SQL uit `supabase/` in de
juiste volgorde, en vult hem met de vier demo-organisaties plus een testscenario
met geld dat nog in de hoofdpot staat. Duurt een paar seconden. Docker is er
niet voor nodig.

| Commando | Wat het doet |
| --- | --- |
| `testdb.sh up` | opzetten en vullen; staat hij er al, dan alleen starten |
| `testdb.sh reset` | helemaal weggooien en opnieuw opbouwen |
| `testdb.sh psql` | een psql-shell erop |
| `testdb.sh status` | draait hij, en wat zit erin |
| `testdb.sh down` | stoppen |

De data staat in `~/.kaspio-testdb`. Weggooien mag altijd, `reset` bouwt hem
opnieuw. Gooi je de map weg terwijl de server nog draait, dan ruimt het script
die achtergebleven server zelf op.

`up` laadt het schema niet opnieuw als er al iets in staat. De SQL in
`supabase/` is namelijk niet idempotent: `schema.sql` maakt tabellen zonder
`if not exists`, dus een tweede keer laden loopt stuk. Wil je een schone lei,
gebruik dan `reset`.

Een andere poort kan met `KASPIO_TESTDB_PORT=55444 ./scripts/testdb/testdb.sh up`.

## Doen alsof je ingelogd bent

RLS werkt hier echt, dus je moet vertellen wie je bent. Net als bij Supabase
komt dat uit de JWT-claims:

```sql
select public.login_as('11111111-1111-1111-1111-111111111111');
set role authenticated;

select count(*) from public.pots;   -- 33, want dit lid zit in alle demo-orgs

reset role;
select public.login_as(null);       -- weer uitgelogd
```

Twee gebruikers staan klaar:

| uuid | e-mail | zit in |
| --- | --- | --- |
| `1111...1111` | demo@kaspio.be | alle vier de demo-orgs, als admin |
| `2222...2222` | lid@kaspio.be | nergens, handig om te testen dat RLS dichthoudt |

Vergeet `set role authenticated` niet. Als `postgres` omzeil je RLS en zie je
alles, wat precies het tegenovergestelde is van wat je wil testen.

## Het testscenario

De demo-seeds wijzen alles netjes toe, dus daar valt niets te testen aan de
hoofdpot. `04-scenario.sql` zet daarom in Scouts Sint-Joris vijf regels neer die
nog geen potje hebben: vier inkomsten en één uitgave, samen 1.780 euro.

```sql
select counterparty, direction, amount from public.transactions where pot_id is null;
```

Dat is de toestand waarin het verdeel-probleem zich voordoet, en dus waar het
nieuwe allocatie-model tegen getest moet worden.

## Wat hier nagebootst is

Op een kale Postgres ontbreekt alles wat Supabase eromheen zet.
`00-bootstrap.sql` vult dat aan:

- de rollen `anon`, `authenticated` en `service_role`
- het `auth`-schema met `auth.users`, `auth.uid()` en `auth.role()`
- `storage.buckets`, `storage.objects` en `storage.foldername`, voor de
  bijlage-policies
- de publicatie `supabase_realtime`
- een lege `cron`-schil, want pg_cron zit niet in een Homebrew-Postgres

Twee dingen zijn bewust zo gezet dat ze de echte instantie volgen in plaats van
de standaard van Postgres:

- **Tabelrechten** (`03-grants.sql`). Zonder grants op de tabellen krijg je
  "permission denied" en bereik je de policies nooit. Dan denk je RLS te testen
  terwijl je alleen ontbrekende rechten test.
- **Functierechten.** Postgres geeft bij `CREATE FUNCTION` standaard EXECUTE aan
  PUBLIC, maar op productie staat `anon` op false. De bootstrap trekt die
  standaard in, zodat je lokaal niet ruimere rechten test dan je echt hebt.

## Waar het afwijkt van productie

- **Geen PostgREST, geen Auth, geen Storage.** Dit is de databank, niet de API.
  Je kan de app er dus niet zomaar tegen laten praten.
- **pg_cron plant niets in.** `cron.schedule` schrijft in een gewone tabel. De
  functies die de cron aanroept, zoals `book_due_reservations`, bestaan wel en
  kan je met de hand draaien.
- **`create extension pg_cron` wordt lokaal weggefilterd** door de runner. De
  SQL in `supabase/` blijft ongewijzigd.
- **De laadvolgorde staat in `01-order.txt`.** Die stond nergens vast; de
  bestanden in `supabase/` hinten er alleen naar in comments. Voeg je een
  bestand toe, zet het dan ook in die lijst.

## De app ertegen draaien

Daarvoor heb je de volledige stack nodig, met PostgREST en Auth erbij. De
Supabase CLI kan dat (`supabase start`), maar dat vereist een draaiende Docker.
Docker Desktop staat geïnstalleerd maar draaide niet toen dit geschreven werd,
dus die route is nog niet uitgeprobeerd en staat hier bewust niet als
kant-en-klaar recept. Start Docker en zeg het, dan wordt dit stuk aangevuld en
getest.
