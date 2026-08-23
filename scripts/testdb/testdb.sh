#!/usr/bin/env bash
# =============================================================================
# Kaspio testdatabase
# =============================================================================
# Zet lokaal een databank op met het volledige schema uit supabase/, zodat je
# migraties, constraints en RLS kan testen zonder productie aan te raken.
#
#   ./scripts/testdb/testdb.sh up      lokale Postgres opzetten en vullen
#   ./scripts/testdb/testdb.sh reset   weggooien en opnieuw opbouwen
#   ./scripts/testdb/testdb.sh psql    psql-shell erop openen
#   ./scripts/testdb/testdb.sh down    stoppen
#   ./scripts/testdb/testdb.sh status  draait hij, en wat zit erin
#
# Wil je ook de app ertegen draaien, dan heb je PostgREST en Auth nodig:
#   supabase start                       (vereist Docker)
#   ./scripts/testdb/testdb.sh supabase  schema + demodata erin laden
#
# Werkt op een kale Postgres (Homebrew), dus zonder Docker. Wil je ook de app
# ertegen draaien, dan heb je de volledige Supabase-stack nodig; zie README.md.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SQL_DIR="$ROOT/supabase"

PGPORT="${KASPIO_TESTDB_PORT:-55433}"
PGDATA="${KASPIO_TESTDB_DATA:-$HOME/.kaspio-testdb/data}"
SOCK="${KASPIO_TESTDB_SOCK:-/tmp/kaspio-testdb}"
DBNAME=kaspio_test
LOG="$(dirname "$PGDATA")/postgres.log"

psql_q() { psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DBNAME" -v ON_ERROR_STOP=1 -q "$@"; }

# Draait een app-SQL-bestand, met de aanpassingen die alleen lokaal nodig zijn.
# pg_cron zit niet in een Homebrew-Postgres; scripts/testdb/00-bootstrap.sql zet
# er een lege schil voor neer, dus de create extension mag eruit. De app-SQL
# zelf blijft ongemoeid.
run_app_sql() {
  sed -e 's|^create extension if not exists pg_cron;|-- lokaal overgeslagen: create extension pg_cron;|' "$1" \
    | psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DBNAME" -v ON_ERROR_STOP=1 -q >/dev/null
}
psql_t() { psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DBNAME" -tA "$@"; }

running() { pg_ctl -D "$PGDATA" status >/dev/null 2>&1; }

# Een postmaster kan de poort nog bezet houden terwijl $PGDATA al weg is,
# bijvoorbeeld na een handmatige rm -rf. pg_ctl kent hem dan niet meer, dus
# halen we de pid uit het lock-bestand van de socket en stoppen we hem daarmee.
stop_orphan() {
  local lock="$SOCK/.s.PGSQL.$PGPORT.lock"
  [ -f "$lock" ] || return 0
  local pid
  pid="$(head -1 "$lock" 2>/dev/null || true)"
  case "$pid" in ''|*[!0-9]*) return 0 ;; esac
  kill -0 "$pid" 2>/dev/null || return 0
  echo "-> oude server (pid $pid) houdt poort $PGPORT nog bezet, die stoppen"
  kill -INT "$pid" 2>/dev/null || true
  for _ in $(seq 1 40); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.2
  done
}

start_server() {
  mkdir -p "$SOCK" "$(dirname "$PGDATA")"
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    stop_orphan
    echo "-> nieuwe cluster aanmaken in $PGDATA"
    LANG=C LC_ALL=C initdb -U postgres -A trust --locale=C -E UTF8 -D "$PGDATA" >/dev/null
  fi
  if ! running; then
    echo "-> Postgres starten op poort $PGPORT"
    if ! LANG=C LC_ALL=C pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $SOCK" -l "$LOG" start >/dev/null; then
      echo
      echo "Starten mislukt. Laatste regels uit $LOG:"
      tail -8 "$LOG" 2>/dev/null || true
      echo
      echo "Zit er nog iets op poort $PGPORT? Probeer: ./scripts/testdb/testdb.sh down"
      echo "Of kies een andere poort: KASPIO_TESTDB_PORT=55444 ./scripts/testdb/testdb.sh up"
      exit 1
    fi
    for _ in $(seq 1 40); do
      pg_isready -h "$SOCK" -p "$PGPORT" -q && break
      sleep 0.2
    done
    if ! pg_isready -h "$SOCK" -p "$PGPORT" -q; then
      echo "Server start niet binnen 8 seconden. Zie $LOG"; exit 1
    fi
  fi
  psql -h "$SOCK" -p "$PGPORT" -U postgres -tAc \
    "select 1 from pg_database where datname='$DBNAME'" | grep -q 1 \
    || createdb -h "$SOCK" -p "$PGPORT" -U postgres "$DBNAME"
}

load_schema() {
  echo "-> Supabase-omgeving nabootsen"
  psql_q -f "$HERE/00-bootstrap.sql"

  echo "-> app-schema laden"
  local n=0
  while read -r line; do
    line="${line%%#*}"; line="$(echo "$line" | xargs || true)"
    [ -z "$line" ] && continue
    n=$((n+1))
    printf '   %2d. %-34s' "$n" "$line"
    if run_app_sql "$SQL_DIR/$line" 2>"$SOCK/err.txt"; then
      echo "ok"
    else
      echo "FOUT"
      echo
      sed -n '1,12p' "$SOCK/err.txt"
      echo
      echo "Gestrand op $line. Volgorde staat in scripts/testdb/01-order.txt."
      exit 1
    fi
  done < "$HERE/01-order.txt"

  echo "-> tabelrechten"
  psql_q -f "$HERE/03-grants.sql"

  echo "-> testgebruikers"
  psql_q -f "$HERE/02-users.sql"

  echo "-> demodata"
  for f in demo-seed.sql demo-seed-sportclub.sql demo-seed-festival.sql demo-seed-zelfstandige.sql; do
    printf '   %-34s' "$f"
    if run_app_sql "$SQL_DIR/$f" 2>"$SOCK/err.txt"; then echo "ok"; else
      echo "overgeslagen"; sed -n '1,4p' "$SOCK/err.txt"
    fi
  done

  echo "-> testscenario (geld in de hoofdpot)"
  psql_q -f "$HERE/04-scenario.sql" >/dev/null
}

summary() {
  echo
  echo "Klaar. Verbinden met:"
  echo "  psql -h $SOCK -p $PGPORT -U postgres -d $DBNAME"
  echo "  of: ./scripts/testdb/testdb.sh psql"
  echo
  psql_t -c "
    select '  ' || rpad(t.tab, 16) || lpad(t.n::text, 6) || ' rijen'
    from (
      select 'organisations' as tab, count(*) n from public.organisations
      union all select 'pots',         count(*) from public.pots
      union all select 'transactions', count(*) from public.transactions
      union all select 'memberships',  count(*) from public.memberships
      union all select 'profiles',     count(*) from public.profiles
    ) t order by t.tab;"
  echo
  echo "Doen alsof je ingelogd bent:  select public.login_as('11111111-1111-1111-1111-111111111111');"
}

# De SQL in supabase/ is niet idempotent (schema.sql maakt tabellen zonder
# "if not exists"), dus opnieuw laden op een gevulde databank loopt stuk.
already_loaded() {
  [ "$(psql_t -c "select to_regclass('public.transactions') is not null" 2>/dev/null)" = "t" ]
}

# Zelfde schema, maar dan in de lokale Supabase-stack. Daar bestaan auth,
# storage, de rollen en de realtime-publicatie al, dus de bootstrap blijft
# achterwege. login_as komt er wel bij, dat is handig in de SQL-editor.
load_supabase() {
  local url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  pg_isready -d "$url" -q || {
    echo "Lokale Supabase draait niet. Start hem met: supabase start"; exit 1; }

  local n=0
  echo "-> app-schema laden in de lokale Supabase"
  while read -r line; do
    line="${line%%#*}"; line="$(echo "$line" | xargs || true)"
    [ -z "$line" ] && continue
    n=$((n+1))
    printf '   %2d. %-34s' "$n" "$line"
    if psql "$url" -v ON_ERROR_STOP=1 -q -f "$SQL_DIR/$line" >/dev/null 2>/tmp/kaspio-sb-err; then
      echo ok
    else
      echo "FOUT"; sed -n '1,10p' /tmp/kaspio-sb-err; exit 1
    fi
  done < "$HERE/01-order.txt"

  echo "-> login_as-hulpje"
  psql "$url" -v ON_ERROR_STOP=1 -q -c "
    create or replace function public.login_as(p_user uuid) returns void
    language plpgsql as \$\$
    begin
      if p_user is null then perform set_config('request.jwt.claims','',false);
      else perform set_config('request.jwt.claims',
        json_build_object('sub', p_user::text, 'role','authenticated')::text, false);
      end if;
    end \$\$;"

  echo "-> demodata"
  for f in demo-seed.sql demo-seed-sportclub.sql demo-seed-festival.sql demo-seed-zelfstandige.sql; do
    printf '   %-34s' "$f"
    psql "$url" -v ON_ERROR_STOP=1 -q -f "$SQL_DIR/$f" >/dev/null 2>&1 && echo ok || echo overgeslagen
  done
  psql "$url" -q -f "$HERE/04-scenario.sql" >/dev/null 2>&1
  echo "-> klaar"
}

case "${1:-up}" in
  supabase) load_supabase ;;
  up)     start_server
          if already_loaded; then
            echo "Databank staat er al. Gebruik 'reset' om opnieuw op te bouwen."
          else
            load_schema
          fi
          summary ;;
  reset)  if running; then pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true; fi
          rm -rf "$PGDATA"; start_server; load_schema; summary ;;
  psql)   start_server >/dev/null; exec psql -h "$SOCK" -p "$PGPORT" -U postgres -d "$DBNAME" ;;
  down)   if running; then pg_ctl -D "$PGDATA" stop -m fast >/dev/null && echo "gestopt";
          else stop_orphan; echo "draaide niet"; fi ;;
  status) if running; then echo "draait op poort $PGPORT"; summary; else echo "draait niet"; fi ;;
  *)      sed -n '2,20p' "$0"; exit 1 ;;
esac
