-- Seeds venue unavailability blocks (SPM-21) so the Venue Staff page, the
-- coordinator's venue search and the booking refusal can be tried in the app:
--
--   Main Hall   Renovation   five days of AM, starting 14 days from today
--   Main Hall   Maintenance  all three slots on the middle day of that week,
--                            so one slot (AM) is covered by two blocks
--   Studio      Safety       one PM slot, already lifted
--
-- Dates are relative to today so the seed never goes stale. Needs the venues
-- from seed-venues and the Venue Staff account from the base seed. Run
-- seed-venues first; this script stops with an error if you did not.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venue-unavailability/seed.sql --local
--
-- Safe to run more than once: each block is guarded by an existence check on
-- its venue and reason, so it never resets a block you have since lifted in
-- the app. For that, run teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_staff     bigint;
  v_main_hall bigint;
  v_studio    bigint;
  v_block     bigint;
  v_start     date := current_date + 14;
begin
  select user_account_id into v_staff
    from public.user_account where name = 'Test Venue Staff' and client_organisation_id is null;
  select venue_id into v_main_hall from public.venue where location = 'Main Hall';
  select venue_id into v_studio    from public.venue where location = 'Studio';

  if v_staff is null or v_main_hall is null or v_studio is null then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_staff is null then 'Test Venue Staff' end,
        case when v_main_hall is null then 'venue Main Hall (run seed-venues)' end,
        case when v_studio is null then 'venue Studio (run seed-venues)' end);
  end if;

  if not exists (select 1 from public.venue_unavailability
                 where venue_id = v_main_hall and reason_category = 'Renovation') then
    insert into public.venue_unavailability (venue_id, reason_category, recorded_by_user_account_id)
    values (v_main_hall, 'Renovation', v_staff)
    returning venue_unavailability_id into v_block;
    insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
    select v_block, d::date, 'AM' from generate_series(v_start, v_start + 4, interval '1 day') d;
  end if;

  if not exists (select 1 from public.venue_unavailability
                 where venue_id = v_main_hall and reason_category = 'Maintenance') then
    insert into public.venue_unavailability (venue_id, reason_category, recorded_by_user_account_id)
    values (v_main_hall, 'Maintenance', v_staff)
    returning venue_unavailability_id into v_block;
    insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
    select v_block, v_start + 2, s from unnest(array['AM', 'PM', 'Night']) s;
  end if;

  if not exists (select 1 from public.venue_unavailability
                 where venue_id = v_studio and reason_category = 'Safety') then
    insert into public.venue_unavailability (venue_id, reason_category, recorded_by_user_account_id)
    values (v_studio, 'Safety', v_staff)
    returning venue_unavailability_id into v_block;
    insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
    values (v_block, v_start + 6, 'PM');
    update public.venue_unavailability
       set lifted_at = now(), lifted_by_user_account_id = v_staff
     where venue_unavailability_id = v_block;
  end if;
end;
$$;
