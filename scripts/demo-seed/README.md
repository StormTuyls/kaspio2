# Demo-org Koninklijke Stade Leuven Tennis

Bouwt een demo-organisatie in Kaspio uit de twee bestanden die de club zelf
gebruikt. Bedoeld om aan die club te tonen, dus met hun eigen cijfers.

- org: `Koninklijke Stade Leuven Tennis`, id `03be1d68-0be2-5b39-b86a-e3135dfdf6ca`
- eigenaar: `stormtuyls@icloud.com`, tier `team`
- vereist de kolom `transactions.bank_account` uit `supabase/bank-account.sql`
  (branch `feat/blok-0-import-rekeningen`)

## Bronnen

| bestand | wat het levert |
|---|---|
| `2026 budget en overzicht in-uit opvolging - Kaspio.xlsx`, blad `BudgetOverzicht` | 14 comités (pot_groups), 118 posten (pots), budget 2026, "Stand 2026" |
| datzelfde bestand, de 13 comité-bladen | bankregels die al per post gesorteerd staan |
| `Cashflow sinds 2004.xlsx`, blad `2026` | de aanzuiveringen tussen eigen rekeningen |

## Hoe de koppeling regel → potje werkt

De comité-bladen zijn een werkdocument, geen export. Kopjes heten niet altijd
zoals de post in BudgetOverzicht (`HUUR - STAD LEUVEN` tegenover `HUUR
TERREINEN`), er zitten tussenkopjes in (loondetails, deelprojecten) en soms
staat er een sectie tussen die niet in het budget voorkomt.

Daarom twee stappen:

1. elke bankregel hoort bij het dichtstbijzijnde kopje erboven dat op een
   budgetpost te herleiden is, op naam of op subtotaal;
2. per post wordt de som vergeleken met "Stand 2026". Alleen posten die tot op
   de cent kloppen worden geclaimd. De rest gaat onbeslist naar de hoofdpot.

Stap 2 is wat het veilig maakt. Waar stap 1 ernaast zit klopt de som niet meer,
en dan belandt die reeks zichtbaar in de inbox in plaats van onzichtbaar op het
verkeerde potje. Resultaat: 47 potjes met een saldo dat exact gelijk is aan het
cijfer in hun eigen budgetbestand, en ~1.045 regels om live te verdelen.

Twee soorten regels blijven er bewust uit:

- **afsluitingsregels** die de club in het rekenblad zelf maakt (`LIDGELDEN
  ZOMER`, `SALDO OPLADINGEN WINTER`). Geen rekening, geen tegenpartij, en het
  geld staat elders al als echte bankverrichting. Ze meenemen laat de potjes
  beter aansluiten op hun boekhoudkundige tussenstand, maar laat het totaal
  ~116k afwijken van de rekening. Dat is de afweging in `build_seed.py`.
- **jaren vóór 2026**, want alleen 2026 is in deze bestanden gecategoriseerd.

## Draaien

```sh
python3 build_seed.py     # leest de xlsx-bestanden, schrijft seed_*.sql
python3 emit_json.py      # zet dat om in payload_*.json
python3 load.py           # laadt in via PostgREST, met RLS aan
```

`load.py` logt in als een tijdelijk admin-account (`seed-admin@demo.kaspio.be`).
Maak dat account aan vóór het laden en verwijder het erna; de inserts lopen dan
door dezelfde policies en triggers als de app zelf, wat meteen een test daarvan
is. Alle ids zijn `uuid5` uit de naam, dus opnieuw draaien geeft dezelfde ids.

Leegmaken gaat niet met een gewone `delete from pots`: de hoofdpot is beschermd
en de audit-trigger struikelt over een cascade. Gebruik hetzelfde patroon als
`supabase/delete-organisation.sql`, namelijk
`set_config('kaspio.skip_audit','on',true)` en dan de organisatie zelf wissen.

## Twee app-bugs die deze demo blootlegde

Beide zijn gefixt in de worktree op `feat/blok-0-import-rekeningen`, nog niet
gecommit.

**1. PostgREST kapt af op 1000 rijen.** `useTransactions` haalde transacties en
allocaties op zonder paginatie. De API geeft dan stilletjes de eerste 1000 rijen
terug, zonder fout, en alles wat de UI optelt klopt niet meer. Met 2.387
verrichtingen toonde het dashboard € -25.723,43 in plaats van € 17.260,18, en
"73 transacties toewijzen" in plaats van 1.055. Opgelost met `fetchAllRows()`,
dat pagineert tot een pagina korter is dan de paginagrootte. Let op de vaste
order (id als tiebreaker), anders kan een rij tussen twee pagina's verspringen.

Dit raakt elke club met meer dan 1000 verrichtingen, dus in de praktijk elke
club met een bar.

**2. De ledenteller in de zijbalk telde rijen, geen mensen.** `membersCount`
kreeg `orgMembers.length`, en dat is één rij per (gebruiker, potje) voor
pot_owners. Bij 10 voorzitters over 118 potjes stond er "Leden 120", terwijl de
ledenpagina en de dashboardtegel wél `groupMembersByUser` gebruiken en 12
toonden. Nu overal `uiMembers.length`.

## Demo-accounts

| account | wachtwoord | rol |
|---|---|---|
| `demo@demo.kaspio.be` | `kaspio-demo` | admin, om te presenteren zonder je eigen account |
| `voornaam.achternaam@demo.kaspio.be` | `kaspio-demo` | pot_owner per comité |

Handig om te tonen dat een comitéhoofd alleen zijn eigen potjes ziet: Bernard
Dewamme ziet er 17, Anja Koch 10, Gert Vanderlinden 34 (hij trekt vier comités).

Het beginsaldo staat als bevestigde regel in de hoofdpot, zodat het als
verdeelbaar geld meetelt (€ 73.098,41) in plaats van in de inbox te blijven
hangen.
