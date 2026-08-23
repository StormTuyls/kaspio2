# Hoofdpot en allocaties

Datum: 2026-08-23
Status: ontwerp, wacht op akkoord. Migratie nog niet geschreven.

## Waarom

Verdelen en toewijzen zijn vandaag twee routes naar hetzelfde geld die niets van
elkaar weten. `allocateFromHoofdpot` werkt op het saldo en verzint een
tegenboeking; de onderliggende transacties blijven op `pot_id null` staan en
blijven dus in de inbox hangen. Wie ze daarna alsnog toewijst boekt hetzelfde
geld een tweede keer. Resultaat in de praktijk: een dashboard dat "alles
verdeeld" zegt terwijl er nog transacties open staan, en een totaalsaldo dat
niet meer klopt met de rekening.

Twee dingen die daar los van staan maar hetzelfde probleem hebben, namelijk dat
het bankfeit niet heilig is:

- `assignTransaction` doet bij splitsen `update({ pot_id, amount })` op de
  originele rij. Een import van 1.000 euro die je over twee potjes splitst,
  zegt daarna 625 euro. Wat de bank stuurde is weg op de plek waar het hoort.
- `deleteTransaction` doet een echte `DELETE`, en bij een `transfer_group`
  verwijdert het de hele groep. Onherstelbaar.

## Doel

Eén regel die alles afdekt:

> Een bankregel is een feit en verandert nooit meer. Waar dat geld heen gaat is
> een aparte laag, en de databank bewaakt dat je nooit meer kan toewijzen dan er
> binnenkwam.

Concreet:

1. Geen enkele transactie gaat verloren of wordt overschreven.
2. Dubbel toewijzen is onmogelijk, afgedwongen door de databank en niet door
   applicatielogica.
3. Een transactie mag deels toegewezen zijn; de rest blijft in de hoofdpot.
4. Toewijzen kan per transactie én in bulk.
5. De invariant `totaal = som(potjes) + hoofdpot` geldt altijd.

### Niet-doelen

- Volledig dubbel boekhouden met tegenrekeningen. Overwogen (aanpak B), maar het
  dwingt elk scherm om van "een transactie hoort bij een potje" naar "een
  transactie heeft benen" te gaan, zonder dat het meer garanties oplevert dan
  wat hieronder staat.
- Een boekhoudexport of koppeling met externe boekhoudsoftware. Later eventueel,
  het model hieronder maakt het wel mogelijk.

## Datamodel

### transactions wordt onaanraakbaar

Na import verandert er niets meer aan bedrag, datum, tegenpartij of richting.
Twee kolommen erbij:

```sql
alter table public.transactions
  add column if not exists allocated_amount numeric(12,2) not null default 0,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id);

-- Je kan nooit meer toewijzen dan er binnenkwam. Dit is de kern van de garantie.
alter table public.transactions
  add constraint transactions_allocated_within_amount
  check (allocated_amount >= 0 and allocated_amount <= amount);
```

`amount` is altijd positief; `direction` draagt het teken. De constraint kan dus
rechtstreeks op `amount`.

`pot_id` blijft voorlopig bestaan voor de migratie, maar wordt na de overgang
niet meer gelezen. Zie "Migratie".

### allocations

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

`on delete restrict` op beide verwijzingen: een transactie met allocaties kan
niet verdwijnen, en een potje met geld erin evenmin. Wie een potje wil opruimen
moet het geld eerst verplaatsen. Dat is een feature, geen hindernis.

Meerdere allocaties per transactie zijn normaal: dat is splitsen, en dat is ook
hoe een deels toegewezen transactie eruitziet.

### De grens afdwingen

`CHECK` kan niet over rijen heen kijken, dus `allocated_amount` wordt door een
trigger bijgehouden en de `CHECK` bewaakt hem:

```sql
create or replace function public.sync_allocated_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tx uuid := coalesce(new.transaction_id, old.transaction_id);
begin
  -- Vergrendel de ouderrij, anders kunnen twee gelijktijdige allocaties allebei
  -- een verouderde som lezen en samen over het bedrag gaan.
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

Gaat de som over het bedrag, dan faalt de `CHECK` op `transactions` en rolt de
hele insert terug. Twee tabbladen die tegelijk hetzelfde restant toewijzen
kunnen dus niet allebei slagen: de `for update` serialiseert ze en de tweede
krijgt een nette fout.

Dit is het verschil met vandaag. De garantie zit in de databank, dus ook een
bug in de frontend, een verdwaalde RPC-call of een script in de SQL Editor kan
er niet omheen.

### Afgeleide waarden

Niets wordt dubbel opgeslagen. Alles volgt uit de twee tabellen:

| Wat | Hoe |
| --- | --- |
| Saldo van een potje | som van zijn allocaties, getekend met de richting van de transactie |
| Hoofdpot | som van `amount - allocated_amount` over alle niet-gevoide transacties, getekend |
| Totaal saldo | som van alle niet-gevoide transacties, getekend |
| Inbox | transacties met `allocated_amount < amount` en niet gevoid |

De bestaande view `pot_balances` houdt dezelfde kolommen, alleen de bron
verandert van `transactions.pot_id` naar `allocations`. Kolommen weglaten zou
consumers breken, dus `name`, `color`, `target_amount` en `transaction_count`
blijven staan, net als het `archived = false`-filter:

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

`transaction_count` telt nu distinct transacties, niet allocaties, anders telt
een gesplitste transactie dubbel.

Openstaand van vroeger: de view telt ook transacties met `status = 'pending'`
mee, terwijl de frontend daar client-side op filtert (zie de opmerking in
`approval-flows.sql`). Dat verschil bestaat vandaag al en verandert hier niet,
maar het is het overwegen waard om het meteen recht te zetten.

Hieruit volgt `totaal = som(potjes) + hoofdpot` per definitie, want elke euro
van elke transactie zit óf in een allocatie óf in het restant. Dat is precies de
invariant die vandaag kan breken.

### Verwijderen wordt voiden

`DELETE` op transactions verdwijnt uit de app. Een foute regel krijgt
`voided_at` en valt uit alle saldo's, maar blijft leesbaar met haar allocaties
en haar audit-spoor. Voiden mag alleen als er geen allocaties meer op staan, of
het haalt ze in dezelfde transactie weg.

Allocaties zelf mogen wél verdwijnen: dat is een indeling terugdraaien, geen
bankfeit wissen. Dat is ook hoe "verplaatsen naar een ander potje" werkt: oude
allocatie weg, nieuwe erbij, in één transactie.

## Wat er in de app verandert

### Eén mechanisme, twee ingangen

Verdelen en bulk toewijzen worden allebei simpelweg "maak allocatie-rijen aan".
Ze kunnen elkaar niet meer tegenspreken, want ze putten uit hetzelfde restant en
de databank telt mee.

- **Per transactie**: kies potje(s) en bedragen voor deze ene transactie. Mag
  minder zijn dan het totaal; de rest blijft staan.
- **In bulk**: selecteer transacties, kies één potje, wijs het volledige
  openstaande restant van elke selectie toe.
- **Verdelen volgens percentage**: neem het openstaande restant (van alles of
  van een selectie) en verdeel dat over meerdere potjes. Onder water dezelfde
  greedy planner die nu al in `src/allocatePlan.ts` staat en getest is, maar hij
  levert allocatie-rijen op in plaats van gemuteerde transacties.

Of dit één scherm wordt of twee is nog open, zie "Open punten". Het datamodel is
in beide gevallen hetzelfde.

### Code die verdwijnt of verandert

| Nu | Straks |
| --- | --- |
| `assignTransaction` muteert `amount` en `pot_id` | maakt allocatie-rijen, raakt de transactie niet aan |
| `reassignTransactions` zet `pot_id` | verplaatst allocaties |
| `allocateFromHoofdpot` maakt een tegenboeking | maakt allocaties via de bestaande planner |
| `deleteTransaction` doet `DELETE`, cascade op `transfer_group` | zet `voided_at` |
| saldo = som van transacties met dit `pot_id` | saldo = som van allocaties |
| inbox = `pot_id is null` en geen `transfer_group` | inbox = `allocated_amount < amount` |

`transfer_group` blijft bestaan voor echte overboekingen tussen potjes. Die
blijven twee transacties, want dat is ook wat er op de rekening gebeurt, alleen
zonder netto effect. Wel opletten: `csvImport` slaat transfer_group-regels over
bij duplicaatdetectie en het dashboard laat ze uit de in/uit-cijfers. Dat blijft
zo en klopt.

### Meelift-opruiming

`AuditView`, `MembersView` en `UserSwitcher` zijn dode code die alleen nog naar
elkaar verwijzen. Die raken dit model niet aan, maar ze lezen wel `pot_id` en
zouden verwarring geven tijdens de migratie. Apart opruimen, niet hier.

## Migratie

**Nog niet geschreven, met opzet.** Wordt pas uitgewerkt als er een
demo-database staat om hem op te draaien. Ruwe vorm:

1. Voor elke transactie met `pot_id is not null`: één allocatie-rij voor het
   volle bedrag naar dat potje. Levert een correcte 1-op-1 overzetting.
2. `allocated_amount` opnieuw berekenen voor alle transacties, dan pas de
   `CHECK` aanzetten. Doe je het andersom, dan blokkeert de constraint je eigen
   migratie.
3. Controleren dat het totaal per org vóór en ná gelijk is. Wijkt het af, dan
   stoppen en handmatig kijken.

Twee dingen waar het lastig wordt en waar ik een beslissing van jou wil:

- **Bestaande splitsingen.** Een gesplitste transactie is nu een verkorte
  ouderrij plus kinderen met `split_from`. Boekhoudkundig zouden die weer één
  bankregel met meerdere allocaties moeten worden, maar het originele bedrag is
  nergens meer opgeslagen; het is alleen te reconstrueren door ouder en kinderen
  op te tellen. Dat kan, maar het is een gok die je niet kan controleren tegen
  de bank.
- **Bestaande verdeel-paren.** De synthetische `transfer_group`-koppels van het
  oude verdelen zijn geen bankfeit. Ze omzetten naar allocaties op de
  onderliggende transacties is niet altijd eenduidig, want de koppeling tussen
  "welke euro kwam waarvandaan" is nooit vastgelegd.

Voor allebei geldt: de veilige uitweg is ze laten staan zoals ze zijn en enkel
vanaf nu correct boeken. Dat kost je een periode met twee soorten geschiedenis.

De org `test` op productie staat op een negatief totaal door precies deze bug.
Die moet apart bekeken worden voor de migratie, anders migreer je kapotte data
netjes mee.

## Testen

Wat er getest moet zijn voor dit naar productie gaat:

1. **De constraint zelf.** Probeer meer toe te wijzen dan het bedrag en
   verwacht een fout. Probeer het met twee gelijktijdige sessies en verwacht dat
   er precies één slaagt.
2. **De invariant**, als eigenschap: voor willekeurige reeksen van importeren,
   toewijzen, verdelen, verplaatsen en voiden moet
   `totaal = som(potjes) + hoofdpot` blijven kloppen.
3. **Het scenario uit de melding**: importeer 1.000, verdeel alles, probeer
   daarna nog toe te wijzen. De inbox hoort leeg te zijn en de tweede actie hoort
   niet mogelijk te zijn.
4. **De planner** in `src/allocatePlan.ts` heeft al ruim 70 assertions op een
   wegwerpscript. Die verhuizen naar een echte runner, want geldlogica zonder
   testvangnet in CI is precies hoe dit is ontstaan.

Punt 1 en 2 kunnen niet zonder databank. Vandaar de demo-database.

## Demo-database

Er is nu geen veilige plek om dit op te draaien. Voorstel: een script dat een
lokale Postgres opzet met het volledige schema uit `supabase/*.sql` plus
seed-data, zodat migratie en constraints echt getest kunnen worden zonder
productie aan te raken. Dat is ook meteen de plek waar de invariant-tests
draaien.

Dit is de eerstvolgende stap, vóór de migratie.

## Open punten

1. **Eén scherm of twee** voor verdelen en bulk toewijzen. Het datamodel is
   hetzelfde; dit is puur een keuze over hoe het voelt.
2. **Bestaande splitsingen en verdeel-paren**: reconstrueren of laten staan.
3. **De `test`-org** op productie: opruimen, of laten staan als testdata.
