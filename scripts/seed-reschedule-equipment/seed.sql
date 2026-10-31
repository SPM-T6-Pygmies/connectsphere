-- Seeds the SPM-311 manual cases on top of the SPM-273 equipment review seed:
-- two of its events get their times, and a change request from their
-- Organiser that their Coordinator has yet to decide.
--
--   Event                Now                     Request                 Case
--   Tech Summit Keynote  13 Dec, 09:00-12:00     20 Dec, 09:00-12:00     a new date (AC1-3)
--   Board Strategy Day   13 Dec, 09:00-12:00     13 Dec, 14:00-17:00     a new time, same date (AC4)
--
-- Tech Summit Keynote's lines, from the equipment review seed: Projector 4,
-- New, nothing reserved; Wireless microphone 6 (was 4), Changed, 4 held;
-- PA speaker 2, Removal requested, 2 held. Board Strategy Day's Projector 2
-- and Wireless microphone 2 are Reserved in full.
--
-- Run against a local stack, after the equipment review seed:
--   supabase db query --file scripts/seed-equipment-review/seed.sql --local
--   supabase db query --file scripts/seed-reschedule-equipment/seed.sql --local
--
-- Safe to run more than once: an event that already has times or a change
-- request is left as it is. For a fresh start run teardown.sql here and in
-- seed-equipment-review, then both seeds. verify.sql checks the seeded state.

do $$
declare
  v_organiser    bigint;
  v_organisation bigint;
  v_event        record;
  v_event_id     bigint;
  v_request      bigint;
begin
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  for v_event in
    select *
    from (values
      ('Tech Summit Keynote', '[{"date":"2026-12-20","start":"09:00","end":"12:00"}]'),
      ('Board Strategy Day',  '[{"date":"2026-12-13","start":"14:00","end":"17:00"}]')
    ) as e(name, requested_times)
  loop
    select event_id into v_event_id
      from public.event
      where name = v_event.name and client_organisation_id = v_organisation and event_request_id is null;

    if v_event_id is null then
      raise exception 'Missing: %', v_event.name
        using hint = 'Run scripts/seed-equipment-review/seed.sql first.';
    end if;

    if exists (select 1 from public.event_slot where event_id = v_event_id)
       or exists (select 1 from public.change_request where event_id = v_event_id) then
      continue;
    end if;

    -- 13 Dec, 09:00-12:00, as the 15-minute slots it is stored as.
    insert into public.event_slot (event_id, slot_date, slot_code)
    select v_event_id, date '2026-12-13', s.slot_code
    from public.slot s
    where s.slot_code ~ '^[0-9]+$'
      and s.start_time >= time '09:00'
      and s.end_time <= time '12:00';

    insert into public.change_request (event_id, requesting_user_account_id)
    values (v_event_id, v_organiser)
    returning change_request_id into v_request;

    insert into public.change_request_item (change_request_id, field_name, requested_value)
    values (v_request, 'times', v_event.requested_times);
  end loop;
end;
$$;
