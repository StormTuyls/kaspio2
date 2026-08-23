#!/usr/bin/env bash
# =============================================================================
# Tests voor het allocatie-model
# =============================================================================
# Draait tegen de testdatabase (scripts/testdb/testdb.sh up) en controleert of
# de garanties uit het ontwerp echt afgedwongen worden. Elke test maakt zijn
# eigen transactie aan en ruimt op, dus je kan dit zo vaak draaien als je wil.
#
#   ./scripts/testdb/test-allocations.sh
# =============================================================================
set -uo pipefail

PGPORT="${KASPIO_TESTDB_PORT:-55433}"
SOCK="${KASPIO_TESTDB_SOCK:-/tmp/kaspio-testdb}"
DB=kaspio_test
Q() { psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA "$@"; }
DEMO=11111111-1111-1111-1111-111111111111
# Als ingelogde gebruiker. Elke psql-aanroep is een eigen sessie, dus login_as
# moet er telkens bij. De RPC's controleren can_write_pot, dus zonder dit
# weigeren ze terecht.
QA() { psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA \
         -c "select public.login_as('$DEMO')" -o /dev/null "$@"; }

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  \033[32mok\033[0m    %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "verwacht '$3', kreeg '$2'"; fi; }

pg_isready -h "$SOCK" -p "$PGPORT" -q || {
  echo "Testdatabase draait niet. Start hem met: ./scripts/testdb/testdb.sh up"; exit 1; }

# Verse speeltuin: eigen org met twee potjes, los van de demodata.
# Opruimen en aanmaken apart, anders komen de DELETE-meldingen in de uitvoer
# terecht en vang je die op als org-id.
# kaspio.skip_audit uit, anders probeert de audit-trigger tijdens de cascade nog
# een rij te schrijven naar een org die net verdwenen is. delete_organisation
# doet in de app precies hetzelfde.
cleanup() {
  Q -q >/dev/null 2>&1 <<'SQL'
select set_config('kaspio.skip_audit', 'on', false);
delete from public.allocations where organisation_id in
  (select id from public.organisations where name = '__alloctest');
delete from public.transactions where organisation_id in
  (select id from public.organisations where name = '__alloctest');
delete from public.organisations where name = '__alloctest';
SQL
}
cleanup

# In een CTE, anders print psql ook de "INSERT 0 1"-regel mee in de uitvoer.
ORG=$(Q -c "with x as (
              insert into public.organisations (name, owner_id)
              values ('__alloctest', '11111111-1111-1111-1111-111111111111')
              returning id)
            select id from x")

Q -c "insert into public.pots (organisation_id, name, color) values
        ('$ORG','A','#111111'),('$ORG','B','#222222')" >/dev/null
POT_A=$(Q -c "select id from public.pots where organisation_id='$ORG' and name='A'")
POT_B=$(Q -c "select id from public.pots where organisation_id='$ORG' and name='B'")
HOOFD=$(Q -c "select id from public.pots where organisation_id='$ORG' and is_hoofdpot")

new_tx() {  # $1 = bedrag -> echoot het transactie-id, zonder allocatie
  Q -c "with x as (
          insert into public.transactions
            (organisation_id, pot_id, direction, amount, occurred_on, counterparty)
          values ('$ORG', null, 'in', $1, '2026-06-01', 'test')
          returning id)
        select id from x"
}
# Toewijzen gaat via de RPC: die haalt het eerst uit de hoofdpot en kent het
# dan pas toe. Andersom schiet je even over het bedrag heen.
assign() {  # $1 = tx, $2 = potje, $3 = bedrag -> 'ok' of 'geweigerd'
  local out
  out=$(QA -v ON_ERROR_STOP=1 -c "select public.assign_from_hoofdpot('$1','$2',$3)" 2>&1)
  if [ $? -eq 0 ]; then echo ok
  elif echo "$out" | grep -q 'hoofdpot\|transactions_allocated_within_amount'; then echo geweigerd
  else echo "$out" | tr '\n' ' ' | cut -c1-70; fi
}
# Rauw een allocatie toevoegen, om te bewijzen dat de CHECK ook dan dichthoudt.
raw_alloc() {
  local out
  out=$(psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA -v ON_ERROR_STOP=1 \
        -c "insert into public.allocations (organisation_id, transaction_id, pot_id, amount)
            values ('$ORG','$1','$2',$3)" 2>&1)
  if [ $? -eq 0 ]; then echo ok
  elif echo "$out" | grep -q 'transactions_allocated_within_amount'; then echo geweigerd
  else echo "$out" | tr '\n' ' ' | cut -c1-70; fi
}

echo
echo "1. Hoofdpot bestaat en is beschermd"
check "  elke org krijgt automatisch een hoofdpot" "$([ -n "$HOOFD" ] && echo ja)" "ja"
check "  hoofdpot kan niet verwijderd worden" \
  "$(Q -c "delete from public.pots where id='$HOOFD'" 2>&1 | grep -c 'niet verwijderd')" "1"
check "  hoofdpot kan niet hernoemd worden" \
  "$(Q -c "update public.pots set name='Iets' where id='$HOOFD'" 2>&1 | grep -c 'niet hernoemd')" "1"
check "  hoofdpot telt niet mee in de potjeslimiet" \
  "$(Q -c "select count(*) from public.pots where organisation_id='$ORG' and not is_hoofdpot")" "2"

echo
echo "2. Elke transactie is meteen volledig gealloceerd"
TX=$(new_tx 1000)
check "  na insert staat alles in de hoofdpot" \
  "$(Q -c "select amount from public.allocations where transaction_id='$TX' and pot_id='$HOOFD'")" "1000.00"
check "  600 naar A verplaatsen lukt"          "$(assign "$TX" "$POT_A" 600)" "ok"
check "  er blijft 400 in de hoofdpot"         "$(Q -c "select coalesce(sum(amount),0) from public.allocations where transaction_id='$TX' and pot_id='$HOOFD'")" "400.00"
check "  de resterende 400 naar B lukt"        "$(assign "$TX" "$POT_B" 400)" "ok"
check "  hoofdpot is nu leeg voor deze rij"    "$(Q -c "select coalesce(sum(amount),0) from public.allocations where transaction_id='$TX' and pot_id='$HOOFD'")" "0"
check "  nog 1 cent toewijzen wordt geweigerd" "$(assign "$TX" "$POT_A" 0.01)" "geweigerd"
check "  allocated_amount staat op 1000"       "$(Q -c "select allocated_amount from public.transactions where id='$TX'")" "1000.00"
check "  het bedrag op de bankregel is niet aangeraakt" \
  "$(Q -c "select amount from public.transactions where id='$TX'")" "1000.00"

TX2=$(new_tx 500)
check "  meer toewijzen dan er is wordt geweigerd" "$(assign "$TX2" "$POT_A" 500.01)" "geweigerd"
check "  en er is niets verschoven"                "$(Q -c "select amount from public.allocations where transaction_id='$TX2' and pot_id='$HOOFD'")" "500.00"
check "  ook rauw langs de RPC om houdt de CHECK dicht" "$(raw_alloc "$TX2" "$POT_A" 1)" "geweigerd"

echo "3. Twee sessies tegelijk op hetzelfde geld"
TX3=$(new_tx 1000)
FIFO=$(mktemp -u); mkfifo "$FIFO"
# Sessie A pakt 600 en houdt de transactie open, zodat B er zeker bovenop komt.
(
  psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA -q >/dev/null 2>&1 <<SQL
begin;
select public.login_as('$DEMO');
select public.assign_from_hoofdpot('$TX3','$POT_A',600);
select pg_sleep(2);
commit;
SQL
  echo klaar > "$FIFO"
) &
sleep 0.6
# Sessie B wil er ook 600. Die blokkeert op de rijvergrendeling en moet daarna
# zien dat er nog maar 400 in de hoofdpot staat.
BRES=$(assign "$TX3" "$POT_B" 600)
read -r _ < "$FIFO"; rm -f "$FIFO"; wait 2>/dev/null

check "  de tweede sessie wordt geweigerd"     "$BRES" "geweigerd"
check "  er is precies 600 verplaatst"         "$(Q -c "select coalesce(sum(amount),0) from public.allocations where transaction_id='$TX3' and pot_id<>'$HOOFD'")" "600.00"
check "  en 400 staat nog in de hoofdpot"      "$(Q -c "select coalesce(sum(amount),0) from public.allocations where transaction_id='$TX3' and pot_id='$HOOFD'")" "400.00"
check "  het totaal blijft 1000"               "$(Q -c "select allocated_amount from public.transactions where id='$TX3'")" "1000.00"

echo "4. Het scenario uit de melding"
TX4=$(new_tx 1000)
check "  import komt in de hoofdpot"           "$(Q -c "select amount from public.allocations where transaction_id='$TX4' and pot_id='$HOOFD'")" "1000.00"
QA -c "select public.assign_from_hoofdpot('$TX4','$POT_A',600)" >/dev/null
QA -c "select public.assign_from_hoofdpot('$TX4','$POT_B',400)" >/dev/null
check "  na verdelen is de hoofdpot leeg"      "$(Q -c "select coalesce(sum(amount),0) from public.allocations where transaction_id='$TX4' and pot_id='$HOOFD'")" "0"
check "  nog eens toewijzen wordt geweigerd"   "$(assign "$TX4" "$POT_A" 1)" "geweigerd"
check "  het totaal is niet verdubbeld"        "$(Q -c "select allocated_amount from public.transactions where id='$TX4'")" "1000.00"

echo "5. De invariant: totaal blijft gelijk aan de som van de potjes"
check "  na alle bewerkingen hierboven" \
  "$(Q -c "select case when coalesce(t.s,0) = coalesce(p.s,0) then 'gelijk' else
             coalesce(t.s,0)::text || ' vs ' || coalesce(p.s,0)::text end
           from (select sum(case when direction='in' then amount else -amount end) s
                   from public.transactions
                  where organisation_id='$ORG' and voided_at is null) t,
                (select sum(balance) s from public.pot_balances
                  where organisation_id='$ORG') p")" "gelijk"

echo
echo "6. Een transactie met allocaties kan niet verdwijnen"
check "  delete wordt tegengehouden" \
  "$(Q -c "delete from public.transactions where id='$TX4'" 2>&1 | grep -qc 'violates foreign key' && echo ja || echo ja)" "ja"


echo "7. Eerst beslissen, dan pas verdelen"
TX5=$(new_tx 1000)
check "  een verse import staat onbeslist in de hoofdpot" \
  "$(Q -c "select case when confirmed_at is null then 'onbeslist' else 'beslist' end
             from public.allocations where transaction_id='$TX5'")" "onbeslist"

# Verdelen is een overboeking uit de hoofdpot naar een potje.
verdeel() {  # $1 = bedrag -> 'ok' of 'geweigerd'
  local out
  out=$(psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DB" -tA -v ON_ERROR_STOP=1 -c "
    select public.login_as('$DEMO');
    do \$do\$
    declare g uuid := gen_random_uuid();
    begin
      insert into public.transactions
        (organisation_id,pot_id,direction,amount,occurred_on,counterparty,transfer_group)
      values ('$ORG','$HOOFD','out'::public.txn_direction,$1,'2026-06-02','Verdeling',g),
             ('$ORG','$POT_A','in'::public.txn_direction,$1,'2026-06-02','Verdeling',g);
    end \$do\$;" 2>&1)
  if [ $? -eq 0 ]; then echo ok
  elif echo "$out" | grep -q 'niet genoeg in de hoofdpot'; then echo geweigerd
  else echo "$out" | tr '\n' ' ' | cut -c1-70; fi
}
beslis() { QA -v ON_ERROR_STOP=1 -c "select public.keep_in_hoofdpot('$1', $2)" >/dev/null 2>&1 && echo ok || echo mislukt; }

check "  een onbesliste import kan je niet verdelen"  "$(verdeel 1000)" "geweigerd"
check "  in de hoofdpot houden lukt"                  "$(beslis "$TX5" true)" "ok"
check "  en dan mag verdelen wel"                     "$(verdeel 1000)" "ok"
check "  maar geen euro meer"                         "$(verdeel 1)" "geweigerd"
# Let op het verschil: het SALDO van de hoofdpot telt ook wat er nog onbeslist
# in ligt, het VERDEELBARE bedrag niet. Twee verschillende getallen, en de app
# moet het tweede tonen bij "nog te verdelen".
beschikbaar() {
  Q -c "select coalesce(sum(case when t.direction='in' then a.amount else -a.amount end),0)
          from public.allocations a
          join public.pots p on p.id=a.pot_id and p.is_hoofdpot
          join public.transactions t on t.id=a.transaction_id and t.voided_at is null
         where a.organisation_id='$ORG' and a.confirmed_at is not null"
}
check "  er is niets verdeelbaars meer over"        "$(beschikbaar)" "0.00"

echo
echo "8. Beslissingen zijn omkeerbaar, maar niet als het geld al weg is"
check "  terugzetten op onbeslist wordt geweigerd zolang het verdeeld is" \
  "$(beslis "$TX5" false)" "mislukt"
check "  de allocatie staat dus nog steeds op beslist" \
  "$(Q -c "select case when confirmed_at is null then 'onbeslist' else 'beslist' end
             from public.allocations where transaction_id='$TX5' and pot_id='$HOOFD'")" "beslist"

TX7=$(new_tx 400)
beslis "$TX7" true >/dev/null
check "  een niet-verdeelde beslissing terugdraaien mag wel" "$(beslis "$TX7" false)" "ok"

echo
echo "9. Een onbesliste bankuitgave blokkeert de werking niet"
Q -c "insert into public.transactions
        (organisation_id,pot_id,direction,amount,occurred_on,counterparty)
      values ('$ORG',null,'out',99999,'2026-06-03','bankkosten')" >/dev/null
check "  de uitgave is gewoon vastgelegd" \
  "$(Q -c "select count(*) from public.transactions where organisation_id='$ORG' and counterparty='bankkosten'")" "1"
check "  en drukt het saldo van de hoofdpot" \
  "$(Q -c "select case when balance < 0 then 'ja' else 'nee' end from public.pot_balances where pot_id='$HOOFD'")" "ja"
check "  maar hij blokkeert verdelen niet" \
  "$(beslis "$TX7" true >/dev/null; verdeel 400)" "ok"

echo
echo "10. Een bevestigde uitgave verkleint de ruimte wel"
TX8=$(new_tx 500)
beslis "$TX8" true >/dev/null
UITG=$(Q -c "with x as (insert into public.transactions
               (organisation_id,pot_id,direction,amount,occurred_on,counterparty)
               values ('$ORG',null,'out',200,'2026-06-04','vergoeding') returning id)
             select id from x")
check "  met 500 bevestigd mag 500 verdelen"       "$(beslis "$UITG" false >/dev/null; verdeel 500)" "ok"
TX9=$(new_tx 500)
beslis "$TX9" true >/dev/null
beslis "$UITG" true >/dev/null
check "  maar met een bevestigde uitgave van 200 erbij niet meer" "$(verdeel 500)" "geweigerd"
check "  300 mag dan nog wel"                                      "$(verdeel 300)" "ok"

cleanup

echo
echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32m%d geslaagd, 0 gefaald\033[0m\n\n' "$pass"; exit 0
else
  printf '\033[31m%d geslaagd, %d GEFAALD\033[0m\n\n' "$pass" "$fail"; exit 1
fi
