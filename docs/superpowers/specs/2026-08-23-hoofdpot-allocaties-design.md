# Hoofdpot, toewijzen en verdelen

Datum: 2026-08-23
Status: ontwerp, wacht op akkoord. Migratie nog niet geschreven.

## Waarom

Verdelen en toewijzen zijn vandaag twee routes naar hetzelfde geld die niets van
elkaar weten. `allocateFromHoofdpot` werkt op het saldo en verzint een
tegenboeking; de onderliggende transacties blijven op `pot_id null` staan en
blijven dus in de inbox hangen. Wie ze daarna alsnog toewijst boekt hetzelfde
geld een tweede keer. In de praktijk zag dat er zo uit: een dashboard dat "alles
verdeeld" meldt terwijl er nog transacties open staan, en een totaalsaldo dat
niet meer klopt met de rekening.

Twee dingen die daar los van staan maar dezelfde oorzaak hebben, namelijk dat de
bankregel niet heilig is:

- `assignTransaction` doet bij splitsen `update({ pot_id, amount })` op de
  originele rij. Een import van 1.000 euro die je over twee potjes splitst, zegt
  daarna 625 euro. Wat de bank stuurde is weg op de plek waar het hoort.
- `deleteTransaction` doet een echte `DELETE`, en bij een `transfer_group`
  verwijdert het de hele groep. Onherstelbaar.

## Het model

Drie begrippen, strikt gescheiden.

**De bankregel is een feit.** Bedrag, datum, tegenpartij en richting veranderen
na import nooit meer. Niets overschrijft ze, niets verwijdert ze.

**Toewijzen zegt bij welk potje een bankregel hoort.** Dat mag over meerdere
potjes tegelijk, zoals nu al in het toewijs-paneel: potje plus bedrag, en
"+ Verdeel over meerdere potjes" voor een extra regel. Samen zijn de delen exact
het bedrag van de bankregel.

**Verdelen is een geldbeweging, geen herclassificatie.** Het haalt geld uit de
hoofdpot en zet het in andere potjes, via percentage, vast bedrag of maandelijkse
afhouding. Het komt nooit aan een transactie. De transacties die dat geld
leverden blijven onder de hoofdpot staan, ook in de PDF-export.

### Hoofdpot wordt een echt potje

`pot_id IS NULL` verdwijnt als concept. Elke org krijgt één hoofdpot-rij in
`pots`, en bij import komt alles daar terecht. Voordelen:

- De export en alle overzichten hoeven geen uitzondering meer te kennen voor
  "geen potje".
- Verdelen kan een gewone overboeking tussen potjes worden, met de machinerie
  die er al is (`transfer`, `transfer_group`).
- Geld bewust in de hoofdpot laten is een geldige eindtoestand, geen wachtrij
  die leeg moet.

De hoofdpot mag niet meetellen in de potjeslimiet van het gratis plan, anders
kost hij iedereen meteen een van de vijf plekken. `enforce_pot_limit` telt nu
`count(*) from pots where archived = false`, dus er is een kolom nodig om de
hoofdpot te markeren en uit die telling te houden. Diezelfde markering bepaalt
ook dat hij niet verwijderd of hernoemd kan worden.

## Datamodel

### transactions wordt onaanraakbaar

```sql
alter table public.transactions
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists allocated_amount numeric(12,2) not null default 0;

-- De kern van de garantie: je kan een bankregel nooit over meer potjes
-- verdelen dan er binnenkwam.
alter table public.transactions
  add constraint transactions_allocated_within_amount
  check (allocated_amount >= 0 and allocated_amount <= amount);
```

`amount` is altijd positief (`check (amount > 0)` in `schema.sql`), `direction`
draagt het teken. De constraint kan dus rechtstreeks op `amount`.

### allocations

Eén rij per regel in het toewijs-paneel.

```sql
create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  transaction_id uuid not null
    references public.transactions(id) on delete restrict,
  pot_id uuid not null
    references public.pots(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

Bij import krijgt elke transactie één allocatie voor het volle bedrag naar de
hoofdpot. Toewijzen vervangt die door allocaties naar de gekozen potjes;
splitsen is simpelweg meer dan één allocatie. `on delete restrict` zorgt dat een
transactie met allocaties niet kan verdwijnen en een potje met geld erin evenmin.

### De grens afdwingen

`CHECK` kan niet over rijen kijken, dus `allocated_amount` wordt door een trigger
bijgehouden en de `CHECK` bewaakt hem:

```sql
create or replace function public.sync_allocated_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tx uuid := coalesce(new.transaction_id, old.transaction_id);
begin
  -- Vergrendel de ouderrij, anders lezen twee gelijktijdige allocaties allebei
  -- een verouderde som en gaan ze samen over het bedrag.
  perform 1 from public.transactions where id = v_tx for update;

  update public.transactions t
     set allocated_amount = coalesce(
           (select sum(a.amount) from public.allocations a
             where a.transaction_id = v_tx), 0)
   where t.id = v_tx;

  return coalesce(new, old);
end $$;

create trigger allocations_sync
  after insert or update or delete on public.allocations
  for each row execute function public.sync_allocated_amount();
```

Gaat de som eroverheen, dan faalt de `CHECK` en rolt de hele insert terug. Twee
tabbladen die tegelijk hetzelfde restant toewijzen kunnen niet allebei slagen.
De garantie zit in de databank, dus ook een bug in de frontend of een script in
de SQL Editor komt er niet omheen.

### Verdelen kan de hoofdpot niet leegtrekken

Verdelen maakt overboekingsregels aan, geen allocaties. Om te voorkomen dat je
geld verdeelt dat je al hebt toegewezen (of omgekeerd), geldt één regel: **de
hoofdpot kan niet onder nul door een uitgaande beweging.**

Dat wordt afgedwongen in de RPC die verdeelt en in de RPC die toewijst: beide
vergrendelen de hoofdpot, berekenen het saldo, en weigeren als de beweging het
negatief zou maken. De melding is dan expliciet, bijvoorbeeld "dit geld is al
verdeeld over de potjes".

Een onverdeelde uitgave mag de hoofdpot wél negatief maken; dat is een echt
bankfeit en geen fout. De regel geldt alleen voor bewegingen die de gebruiker
zelf initieert.

### Afgeleide waarden

| Wat | Hoe |
| --- | --- |
| Saldo van een potje | som van allocaties naar dat potje plus de overboekingen erheen, getekend met de richting |
| Hoofdpot | idem, maar dan voor het hoofdpot-potje |
| Totaal saldo | som van alle niet-gevoide transacties, getekend |
| Inbox | transacties waarvan de allocatie nog volledig op de hoofdpot staat |

De bestaande view `pot_balances` houdt dezelfde kolommen, alleen de bron
verandert. Kolommen weglaten zou consumers breken:

```sql
create or replace view public.pot_balances as
select
  p.id as pot_id,
  p.organisation_id,
  p.name,
  p.color,
  p.target_amount,
  coalesce(sum(case when t.direction = 'in' then a.amount
                    else -a.amount end), 0) as balance,
  count(distinct t.id) as transaction_count
from public.pots p
left join public.allocations a on a.pot_id = p.id
left join public.transactions t
       on t.id = a.transaction_id and t.voided_at is null
where p.archived = false
group by p.id;
```

`transaction_count` telt distinct transacties, niet allocaties, anders telt een
gesplitste transactie dubbel.

Openstaand van vroeger: de view telt ook transacties met `status = 'pending'`
mee, terwijl de frontend daar client-side op filtert (zie de opmerking in
`approval-flows.sql`). Dat verschil bestaat vandaag al, maar het is het
overwegen waard om het meteen recht te zetten.

Hieruit volgt `totaal = som(alle potjes, hoofdpot inbegrepen)` per definitie:
elke euro van elke transactie zit in precies één allocatie, en overboekingen
zijn netto nul. Dat is de invariant die vandaag kan breken.

### Verwijderen wordt voiden

`DELETE` op transactions verdwijnt uit de app. Een foute regel krijgt
`voided_at` en valt uit alle saldo's, maar blijft leesbaar met haar allocaties
en haar audit-spoor. Dit raakt twee knoppen in het toewijs-scherm: de
"Verwijderen" in de balk en het kruisje per rij.

Allocaties mogen wél verdwijnen: dat is een indeling terugdraaien, geen bankfeit
wissen. Zo werkt "verplaatsen naar een ander potje" ook: oude allocatie weg,
nieuwe erbij, in één databanktransactie.

## Wat er in de code verandert

| Nu | Straks |
| --- | --- |
| `assignTransaction` muteert `amount` en `pot_id` | maakt allocatie-rijen, raakt de transactie niet aan |
| `reassignTransactions` zet `pot_id` | verplaatst allocaties |
| `allocateFromHoofdpot` maakt een tegenboeking en laat de inbox vol | maakt overboekingsregels uit het hoofdpot-potje |
| `deleteTransaction` doet `DELETE`, cascade op `transfer_group` | zet `voided_at` |
| saldo = som van transacties met dit `pot_id` | saldo = som van allocaties en overboekingen |
| inbox = `pot_id is null` en geen `transfer_group` | inbox = allocatie staat nog op de hoofdpot |

De schermen blijven zoals ze zijn. Het toewijs-paneel met potje, bedrag en
"+ Verdeel over meerdere potjes" verandert niet van vorm; alleen wat eronder
opgeslagen wordt. De bulk-toewijzing die op `responsive-pass` staat past hier
naadloos in: een selectie krijgt allocaties naar hetzelfde potje.

`transfer_group` blijft voor echte overboekingen. Let op dat `csvImport`
transfer_group-regels overslaat bij duplicaatdetectie en dat het dashboard ze
uit de in/uit-cijfers laat. Dat blijft kloppen en moet zo blijven.

## Migratie

**Nog niet geschreven, met opzet.** Wordt pas uitgewerkt als er een
demo-database staat om hem op te draaien. Ruwe vorm:

1. Per org een hoofdpot-rij aanmaken in `pots`, gemarkeerd zodat de potjeslimiet
   hem overslaat.
2. Elke transactie met `pot_id is null` krijgt een allocatie voor het volle
   bedrag naar de hoofdpot; elke transactie met een `pot_id` krijgt er een naar
   dat potje.
3. `allocated_amount` berekenen, dan pas de `CHECK` aanzetten. Andersom
   blokkeert de constraint je eigen migratie.
4. Per org controleren dat het totaal vóór en ná gelijk is. Wijkt het af, dan
   stoppen.

Drie plekken waar het lastig wordt en waar een beslissing nodig is:

- **Bestaande splitsingen.** Een gesplitste transactie is nu een verkorte
  ouderrij plus kinderen met `split_from`. Boekhoudkundig hoort dat weer één
  bankregel met meerdere allocaties te worden, maar het originele bedrag is
  nergens bewaard; het is alleen te reconstrueren door ouder en kinderen op te
  tellen. Dat kan, maar het is een gok die je niet tegen de bank kan controleren.
- **Bestaande verdeel-paren.** De synthetische `transfer_group`-koppels van het
  oude verdelen zijn geen bankfeit. In het nieuwe model zijn ze wél geldig
  (overboeking uit de hoofdpot), dus die kunnen waarschijnlijk gewoon blijven
  staan zodra de hoofdpot een echt potje is.
- **De org `test`** op productie staat op een negatief totaal door precies deze
  bug. Die moet apart bekeken worden, anders migreer je kapotte data netjes mee.

## Testen

1. **De constraint zelf.** Meer toewijzen dan het bedrag moet falen. Twee
   gelijktijdige sessies op hetzelfde restant: precies één mag slagen.
2. **De hoofdpot-regel.** Verdelen en daarna dezelfde transactie toewijzen moet
   geweigerd worden, en omgekeerd.
3. **De invariant**, als eigenschap: voor willekeurige reeksen van importeren,
   toewijzen, splitsen, verdelen, verplaatsen en voiden moet
   `totaal = som(potjes)` blijven kloppen.
4. **Het scenario uit de melding**: importeer 1.000, verdeel alles, probeer
   daarna nog toe te wijzen.
5. **De planner** in `src/allocatePlan.ts` heeft ruim 70 assertions op een
   wegwerpscript. Die verhuizen naar een echte runner. Geldlogica zonder
   testvangnet in CI is precies hoe dit is ontstaan.

Punt 1 tot en met 4 kunnen niet zonder databank.

## Demo-database

Er is geen veilige plek om dit op te draaien. Voorstel: een script dat lokaal
een Postgres opzet met het volledige schema uit `supabase/*.sql` plus seed-data,
zodat migratie en constraints echt getest kunnen worden zonder productie aan te
raken. Dat is ook waar de invariant-tests draaien.

Dit is de eerstvolgende stap, vóór de migratie.

## Open punten

1. **Bestaande splitsingen migreren**: reconstrueren of laten staan.
2. **De `test`-org** op productie: opruimen of laten staan als testdata.
3. **Verdelen met maandelijkse afhouding** sluit aan op de bestaande
   `recurring_plans` en `book_due_reservations`. Nog uit te werken hoe die twee
   precies in elkaar schuiven.
