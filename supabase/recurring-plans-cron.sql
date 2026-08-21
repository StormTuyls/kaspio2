-- =============================================================================
-- Migratie: reserveringen serverzijdig boeken (pg_cron)
-- Run dit in de Supabase SQL Editor NA supabase/recurring-plans-autoboek.sql.
-- Idempotent: veilig om opnieuw te draaien.
-- =============================================================================
-- Hiervoor deed de browser van een admin het automatisch boeken. Dat werkte
-- enkel wanneer iemand toevallig inlogde, boekte op die dag in plaats van op de
-- reserveerdag, en sloeg een maand zonder login gewoon over. Deze migratie legt
-- het bij de database: een dagelijkse cron boekt wat aan de beurt is, of er nu
-- iemand kijkt of niet.
--
-- Wat er geboekt wordt is enkel de virtuele kant: hoofdpot -> potje, als twee
-- gekoppelde regels met hetzelfde transfer_group (netto nul op de rekening).
-- De echte afhouding boekt Kaspio nooit zelf, die komt via de bankimport, anders
-- telt ze dubbel.
--
-- Alleen regels met auto_book = true. Staat die uit, dan blijft de reservering
-- onder "Te bevestigen" op het dashboard wachten op één klik.
-- =============================================================================

create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- 1. De boeking zelf
-- -----------------------------------------------------------------------------
-- security definer: de cron draait zonder auth.uid(), dus zonder RLS-context.
-- De functie leest en schrijft daarom als eigenaar. Ze is niet aanroepbaar door
-- clients (zie de grants onderaan): er is geen org-parameter, dus wie ze mag
-- draaien, draait ze voor alle organisaties.
--
-- p_run_date verschuift de "vandaag" van de functie. Gebruik die ALTIJD samen met
-- p_dry_run => true: zonder dry run boekt een datum in de toekomst er ook echt
-- op, en zet ze last_run_on vooruit, waardoor die maand later overgeslagen wordt.
-- Dry run schrijft niets en geeft enkel terug wat er geboekt zou worden.
-- Oude versie met enkel een datum-parameter opruimen: die gaf een integer terug,
-- en zolang beide bestaan is een aanroep zonder argumenten dubbelzinnig.
drop function if exists public.book_due_reservations(date);

create or replace function public.book_due_reservations(
  p_run_date date    default current_date,
  p_dry_run  boolean default false
)
returns table (plan_id uuid, potje_id uuid, omschrijving text, bedrag numeric, boekdatum date, geboekt boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan        record;
  v_day         int;
  v_due_on      date;
  v_group       uuid;
  v_label       text;
  v_month_start date := date_trunc('month', p_run_date)::date;
  v_last_day    int  := extract(day from (date_trunc('month', p_run_date) + interval '1 month - 1 day'))::int;
begin
  for v_plan in
    select *
    from public.recurring_plans
    where active
      and auto_book
      -- Een storting reserveert altijd; een domiciliëring enkel wanneer ze
      -- zichzelf financiert (reserve_day gezet).
      and (kind = 'storting' or reserve_day is not null)
      -- Deze maand nog niet geboekt.
      and (last_run_on is null or last_run_on < v_month_start)
  loop
    v_day := case when v_plan.kind = 'storting' then v_plan.day_of_month else v_plan.reserve_day end;
    -- Dag 31 in een korte maand valt terug op de laatste dag van de maand.
    v_due_on := make_date(
      extract(year from p_run_date)::int,
      extract(month from p_run_date)::int,
      least(v_day, v_last_day)
    );

    -- Nog niet aan de beurt deze maand.
    continue when v_due_on > p_run_date;

    v_label := coalesce(nullif(btrim(v_plan.counterparty), ''), 'Reservering');

    -- Dry run: enkel rapporteren, niets claimen en niets boeken.
    if p_dry_run then
      plan_id := v_plan.id; potje_id := v_plan.pot_id; omschrijving := v_label;
      bedrag := v_plan.amount; boekdatum := v_due_on; geboekt := false;
      return next;
      continue;
    end if;

    -- Claim eerst, boek daarna. De voorwaarde staat in de WHERE, dus twee
    -- gelijktijdige runs (of een run naast een klik in de browser) kunnen nooit
    -- allebei winnen.
    update public.recurring_plans
       set last_run_on = v_due_on
     where id = v_plan.id
       and (last_run_on is null or last_run_on < v_month_start);
    continue when not found;

    v_group := gen_random_uuid();

    -- occurred_on is de reserveerdag zelf, niet de dag waarop de cron draait.
    -- Draait de cron een dag te laat, dan staat de boeking toch op de juiste dag.
    insert into public.transactions
      (organisation_id, pot_id, amount, direction, occurred_on, counterparty, transfer_group)
    values
      (v_plan.organisation_id, null,          v_plan.amount, 'out', v_due_on, v_label, v_group),
      (v_plan.organisation_id, v_plan.pot_id, v_plan.amount, 'in',  v_due_on, v_label, v_group);

    plan_id := v_plan.id; potje_id := v_plan.pot_id; omschrijving := v_label;
    bedrag := v_plan.amount; boekdatum := v_due_on; geboekt := true;
    return next;
  end loop;
end;
$$;

comment on function public.book_due_reservations(date, boolean) is
  'Boekt de maandelijkse reserveringen (hoofdpot -> potje) van alle actieve recurring_plans met auto_book, en geeft per regel terug wat er gebeurde. Met p_dry_run => true schrijft ze niets. Draait via pg_cron; niet aanroepbaar door clients.';

-- Clients mogen dit niet draaien: de functie kent geen org-grens.
revoke all on function public.book_due_reservations(date, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Dagelijks draaien
-- -----------------------------------------------------------------------------
-- 04:00 UTC. Vroeg genoeg dat de reservering er 's ochtends staat, en ver genoeg
-- van middernacht dat een zomertijd-sprong niets verschuift.
select cron.unschedule('kaspio-reserveringen')
 where exists (select 1 from cron.job where jobname = 'kaspio-reserveringen');

select cron.schedule(
  'kaspio-reserveringen',
  '0 4 * * *',
  $$ select * from public.book_due_reservations(); $$
);

-- Verificatie:
--   select jobname, schedule, active from cron.job where jobname = 'kaspio-reserveringen';
--   select * from public.book_due_reservations();                       -- nu boeken (schrijft!)
--   select * from public.book_due_reservations(current_date, true);      -- alleen tonen, schrijft niets
--   select * from public.book_due_reservations('2026-09-20', true);      -- idem, alsof het 20 september is
--
-- LET OP: een datum zonder true erachter boekt die datum ook echt, ook als ze in
-- de toekomst ligt. Gebruik voor "wat zou er gebeuren" altijd de dry run.
--   select status, return_message, start_time from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'kaspio-reserveringen')
--     order by start_time desc limit 5;
