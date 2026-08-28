#!/usr/bin/env bash
# =============================================================================
# Tests voor subgroepen onder een potgroep
# =============================================================================
# Draait tegen de testdatabase (scripts/testdb/testdb.sh up) en controleert wat
# supabase/group-subgroups.sql belooft: één niveau diep, de naamregel per
# niveau, wat er gebeurt als je een hoofdgroep verwijdert, en of een
# groepsbeheerder naar beneden erft.
#
#   ./scripts/testdb/test-subgroups.sh
#
# Maakt een eigen org aan en ruimt die achteraf op, dus je kan dit zo vaak
# draaien als je wil.
# =============================================================================
set -uo pipefail

PGPORT="${KASPIO_TESTDB_PORT:-55433}"
SOCK="${KASPIO_TESTDB_SOCK:-/tmp/kaspio-testdb}"
DB=kaspio_test
Q() { psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA "$@"; }
DEMO=11111111-1111-1111-1111-111111111111
LID=22222222-2222-2222-2222-222222222222

# Als echte, niet-superuser gebruiker. Zonder "set role authenticated" draait
# alles als postgres en wordt RLS overgeslagen; dan test je niets.
# Let op: via stdin, niet via meerdere -c. psql -o geldt voor de hele sessie,
# dus met -c /dev/null zou ook het antwoord op de echte query verdwijnen.
QRLS() {  # $1 = user-uuid, $2 = query
  psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA <<SQL
\\o /dev/null
select public.login_as('$1');
set role authenticated;
\\o
$2;
SQL
}

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  \033[32mok\033[0m    %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "verwacht '$3', kreeg '$2'"; fi; }

pg_isready -h "$SOCK" -p "$PGPORT" -q || {
  echo "Testdatabase draait niet. Start hem met: ./scripts/testdb/testdb.sh up"; exit 1; }

cleanup() {
  Q -q >/dev/null 2>&1 <<'SQL'
select set_config('kaspio.skip_audit', 'on', false);
delete from public.organisations where name in ('__subtest', '__subtest2');
SQL
}
cleanup
trap cleanup EXIT

# Potgroepen zijn een Team-functie (groups-tier-gate.sql), dus de testorg moet
# op team staan, anders weigert de trigger elke groep en test je niets.
mkorg() {  # $1 = naam -> org-id
  local id
  id=$(Q -c "with x as (insert into public.organisations (name, owner_id)
                        values ('$1', '$DEMO') returning id) select id from x")
  Q -c "insert into public.subscriptions (organisation_id, tier, status, comped)
        values ('$id', 'team', 'active', true)
        on conflict (organisation_id) do update
          set tier='team', status='active', comped=true" >/dev/null
  echo "$id"
}
ORG=$(mkorg __subtest)
ORG2=$(mkorg __subtest2)

# Groep aanmaken. Echoot het id, of 'geweigerd' als de dieptetrigger of een
# unieke index hem tegenhoudt.
mkgroup() {  # $1 = org, $2 = naam, $3 = parent (of leeg)
  local parent="null" out
  [ -n "${3:-}" ] && parent="'$3'"
  out=$(Q -v ON_ERROR_STOP=1 -c "with x as (
          insert into public.pot_groups (organisation_id, name, parent_id)
          values ('$1', '$2', $parent) returning id) select id from x" 2>&1)
  if [ $? -eq 0 ]; then echo "$out"; else echo geweigerd; fi
}
setparent() {  # $1 = groep, $2 = nieuwe ouder (of leeg voor null)
  local parent="null" out
  [ -n "${2:-}" ] && parent="'$2'"
  out=$(Q -v ON_ERROR_STOP=1 -c \
        "update public.pot_groups set parent_id = $parent where id = '$1'" 2>&1)
  if [ $? -eq 0 ]; then echo ok; else echo geweigerd; fi
}

echo
echo "1. Eén niveau diep"
INFRA=$(mkgroup "$ORG" "Infrastructuur")
ONDERHOUD=$(mkgroup "$ORG" "Onderhoud" "$INFRA")
check "  een subgroep onder een hoofdgroep mag" "$([ ${#ONDERHOUD} = 36 ] && echo ja)" "ja"
check "  een subgroep onder een subgroep niet"  "$(mkgroup "$ORG" "Te diep" "$ONDERHOUD")" "geweigerd"

BAR=$(mkgroup "$ORG" "Bar")
check "  een groep met kinderen kan zelf geen kind worden" "$(setparent "$INFRA" "$BAR")" "geweigerd"
check "  een groep zonder kinderen wel"                    "$(setparent "$BAR" "$INFRA")" "ok"
check "  je eigen hoofdgroep zijn kan niet"                "$(setparent "$INFRA" "$INFRA")" "geweigerd"
check "  een hoofdgroep uit een andere org kan niet" \
  "$(mkgroup "$ORG" "Vreemde tak" "$(mkgroup "$ORG2" "Elders")")" "geweigerd"
setparent "$BAR" "" >/dev/null

echo
echo "2. De naamregel per niveau"
TENNIS=$(mkgroup "$ORG" "Tennisschool")
check "  twee hoofdgroepen met dezelfde naam mag niet" "$(mkgroup "$ORG" "infrastructuur")" "geweigerd"
BAR_IN=$(mkgroup "$ORG" "Inkomsten" "$BAR")
TEN_IN=$(mkgroup "$ORG" "Inkomsten" "$TENNIS")
check "  Bar > Inkomsten mag"                          "$([ "$BAR_IN" != geweigerd ] && echo ja)" "ja"
check "  Tennisschool > Inkomsten ernaast mag ook"     "$([ "$TEN_IN" != geweigerd ] && echo ja)" "ja"
check "  maar twee keer Inkomsten onder Bar niet"      "$(mkgroup "$ORG" "inkomsten" "$BAR")" "geweigerd"

echo
echo "3. Hoofdgroep verwijderen laat de subgroepen staan"
Q -c "insert into public.pots (organisation_id, name, color, group_id)
      values ('$ORG','Dak','#111111','$ONDERHOUD')" >/dev/null
Q -c "delete from public.pot_groups where id='$INFRA'" >/dev/null
check "  de subgroep bestaat nog"                "$(Q -c "select count(*) from public.pot_groups where id='$ONDERHOUD'")" "1"
check "  en is nu zelf een hoofdgroep"           "$(Q -c "select parent_id is null from public.pot_groups where id='$ONDERHOUD'")" "t"
check "  het potje blijft in de subgroep zitten" "$(Q -c "select group_id='$ONDERHOUD' from public.pots where organisation_id='$ORG' and name='Dak'")" "t"

echo
echo "4. Een groepsbeheerder erft naar beneden"
# Verse boom: Infra met Onderhoud eronder, een potje in elk.
INFRA=$(mkgroup "$ORG" "Infra")
ONDERHOUD2=$(mkgroup "$ORG" "Onderhoud werken" "$INFRA")
Q -c "insert into public.pots (organisation_id, name, color, group_id) values
        ('$ORG','Rechtstreeks','#222222','$INFRA'),
        ('$ORG','In subgroep','#333333','$ONDERHOUD2')" >/dev/null
# demo@ is admin (org-eigenaar), lid@ wordt groepsbeheerder van de hoofdgroep.
Q -c "insert into public.memberships (organisation_id, user_id, role, group_id)
      values ('$ORG','$DEMO','admin',null), ('$ORG','$LID','group_owner','$INFRA')" >/dev/null

zichtbaar() {  # $1 = user -> aantal zichtbare potjes uit deze org
  QRLS "$1" "select count(*) from public.pots where organisation_id='$ORG' and not is_hoofdpot"
}
check "  beheerder van de hoofdgroep ziet beide potjes" "$(zichtbaar "$LID")" "2"
check "  hij mag ook in het potje van de subgroep schrijven" \
  "$(QRLS "$LID" "select public.can_write_pot(id) from public.pots
                   where organisation_id='$ORG' and name='In subgroep'")" "t"

# En andersom: beheerder van alleen de subgroep ziet de hoofdgroep niet.
Q -c "update public.memberships set group_id='$ONDERHOUD2'
      where organisation_id='$ORG' and user_id='$LID'" >/dev/null
check "  beheerder van de subgroep ziet alleen zijn eigen potje" "$(zichtbaar "$LID")" "1"
check "  en dat is het potje uit de subgroep" \
  "$(QRLS "$LID" "select name from public.pots
                   where organisation_id='$ORG' and not is_hoofdpot")" "In subgroep"

echo
echo "5. RLS deed echt het werk"
check "  als postgres zie je ze allemaal" \
  "$(Q -c "select count(*) from public.pots where organisation_id='$ORG' and not is_hoofdpot")" "3"

echo
printf '%d ok, %d fout\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
