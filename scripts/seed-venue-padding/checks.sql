-- Checks the database side of the padded approval (SPM-19): approving a booking, or placing a
-- hold on it, is refused when its setup or turnaround time overlaps another live booking's, and
-- accepted when the two only touch. Writes nothing that survives: each case is rolled back, and
-- the script ends in an error whose message is the result.
--
--   error: ok: all N checks held      every check passed. The CLI words this "failed to execute
--                                     query"; the ok: is the pass.
--   error: FAILED: <checks that did not hold>
--
-- Run against a local stack with the base seed, seed-venues and seed-venue-search-uat (it borrows
-- Test Venue Staff, the venues Main Hall 30/45, Studio 0/0 and Seminar Room 2-1 (not set), and the
-- two UAT-44 events):
--   supabase db query --file scripts/seed-venue-padding/checks.sql --local
--
-- Every case books on Monday 21 December 2026. Booking A is already there; booking B is the
-- request Venue Staff decide. Time is 15-minute slots: code n is n*15 minutes after midnight, so
-- 28 is 07:00, 36 is 09:00-09:15, 40 is 10:00, 47 is 11:45-12:00, 88 is 22:00, 95 is 23:45-24:00.

do $$
declare
  v_staff     bigint;
  v_coord     bigint;
  v_event_a   bigint;
  v_event_b   bigint;
  v_venue     bigint;
  v_a         bigint;
  v_b         bigint;
  v_code      text;
  v_msg       text;
  v_detail    text;
  v_result    text;
  v_failed    text[] := '{}';
  v_checks    int := 0;
  c           record;
begin
  select ua.user_account_id into v_staff
    from public.user_account ua where ua.name = 'Test Venue Staff' and ua.client_organisation_id is null;
  select user_account_id into v_coord
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select event_id into v_event_a from public.event where name = 'UAT-44 Booked Harbour';
  select event_id into v_event_b from public.event where name = 'UAT-44 Rejected Garden';
  if v_staff is null or v_coord is null or v_event_a is null or v_event_b is null then
    raise exception 'Run the base seed, seed-venues and seed-venue-search-uat first';
  end if;

  -- Each row: label, venue, A's state, A's date and first and last slot, B's date and first and
  -- last slot, what Venue Staff do with B, and the SQLSTATE they should get ('ok' if it works).
  for c in
    select * from (values
      -- AC1: Main Hall (30 / 45). A 07:00-09:15 keeps the room until 10:00 (turnaround), so a
      -- request for 10:00-12:00, which starts setting up at 09:30, is refused though 09:15 and 10:00 do not touch.
      ('AC1 approve 10:00 after a Confirmed 07:00-09:15 is refused', 'Main Hall', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 40, 47, 'approve', 'CS082'),
      ('AC1 the overlap is a setup against a turnaround: 10:15 still refused', 'Main Hall', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 41, 47, 'approve', 'CS082'),
      -- AC2: B at 10:30 sets up from exactly 10:00, when A's turnaround ends
      ('AC2 approve 10:30 (setup begins as A''s turnaround ends) is accepted', 'Main Hall', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 42, 47, 'approve', 'ok'),
      -- the same the other way round: A after B
      ('AC1 approve 07:00-09:15 before a Confirmed 10:00-12:00 is refused (its turnaround runs into the other setup)', 'Main Hall', 'Confirmed', date '2026-12-21', 40, 47, date '2026-12-21', 28, 36, 'approve', 'CS082'),
      ('AC1 approve 07:00-09:00 before a Confirmed 10:00-12:00 is refused (turnaround to 09:45, setup from 09:30)', 'Main Hall', 'Confirmed', date '2026-12-21', 40, 47, date '2026-12-21', 28, 35, 'approve', 'CS082'),
      ('AC2 approve 07:00-08:45 before a Confirmed 10:00-12:00 is accepted (turnaround ends 09:30, as setup starts)', 'Main Hall', 'Confirmed', date '2026-12-21', 40, 47, date '2026-12-21', 28, 34, 'approve', 'ok'),
      -- AC3: placing a hold is refused the same way
      ('AC3 placing a hold at 10:00 after a Confirmed 07:00-09:15 is refused', 'Main Hall', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 40, 47, 'hold', 'CS082'),
      ('AC3 placing a hold at 10:30 is accepted', 'Main Hall', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 42, 47, 'hold', 'ok'),
      -- AC4: a live hold is padded too
      ('AC4 approve 10:00 after an unexpired hold 07:00-09:15 is refused', 'Main Hall', 'Hold', date '2026-12-21', 28, 36, date '2026-12-21', 40, 47, 'approve', 'CS082'),
      ('AC4 placing a hold at 10:00 after an unexpired hold 07:00-09:15 is refused', 'Main Hall', 'Hold', date '2026-12-21', 28, 36, date '2026-12-21', 40, 47, 'hold', 'CS082'),
      -- AC5: only live bookings count
      ('AC5 a lapsed hold does not block', 'Main Hall', 'LapsedHold', date '2026-12-21', 28, 36, date '2026-12-21', 40, 47, 'approve', 'ok'),
      ('AC5 a Rejected booking does not block', 'Main Hall', 'Rejected', date '2026-12-21', 28, 36, date '2026-12-21', 40, 47, 'approve', 'ok'),
      -- AC1: each venue's own values; a venue with none, or 0 and 0, is checked on the booked times
      ('AC1 Studio (0 / 0): 09:15-10:00 right after 07:00-09:15 is accepted', 'Studio', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 37, 39, 'approve', 'ok'),
      ('AC1 Seminar Room 2-1 (not set): 09:15-10:00 right after 07:00-09:15 is accepted', 'Seminar Room 2-1', 'Confirmed', date '2026-12-21', 28, 36, date '2026-12-21', 37, 39, 'approve', 'ok'),
      ('AC1 an overlap in the booked times themselves is refused the same way', 'Main Hall', 'Confirmed', date '2026-12-21', 40, 47, date '2026-12-21', 44, 50, 'approve', 'CS082'),
      -- AC6: across midnight. A 22:00-24:00 keeps the room until 00:45 the next day
      ('AC6 B 00:15-01:15 the next day, inside A''s turnaround past midnight, is refused', 'Main Hall', 'Confirmed', date '2026-12-21', 88, 95, date '2026-12-22', 1, 4, 'approve', 'CS082'),
      ('AC6 B 01:15-02:15 the next day, whose setup starts 00:45 as A''s turnaround ends, is accepted', 'Main Hall', 'Confirmed', date '2026-12-21', 88, 95, date '2026-12-22', 5, 8, 'approve', 'ok'),
      ('AC6 B 22:00-24:00 is refused by an A the next day at 00:00-01:00 (A''s setup starts 23:30)', 'Main Hall', 'Confirmed', date '2026-12-22', 0, 3, date '2026-12-21', 88, 95, 'approve', 'CS082')
    ) as t (label, venue, a_state, a_date, a_first, a_last, b_date, b_first, b_last, decision, expect)
  loop
    begin
      select venue_id into v_venue from public.venue where location = c.venue;

      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values (v_venue, v_event_a, v_coord) returning booking_id into v_a;
      insert into public.booking_slot (booking_id, slot_date, slot)
        select v_a, c.a_date, n::text from generate_series(c.a_first, c.a_last) n;
      if c.a_state = 'Confirmed' then
        update public.booking set status = 'Confirmed', decided_by_user_account_id = v_staff where booking_id = v_a;
      elsif c.a_state = 'Hold' then
        update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_staff,
               hold_expires_at = now() + interval '1 day' where booking_id = v_a;
      elsif c.a_state = 'LapsedHold' then
        update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_staff,
               hold_expires_at = now() - interval '1 hour' where booking_id = v_a;
      elsif c.a_state = 'Rejected' then
        update public.booking set status = 'Rejected', decided_by_user_account_id = v_staff,
               rejection_note = 'Not needed' where booking_id = v_a;
      end if;

      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values (v_venue, v_event_b, v_coord) returning booking_id into v_b;
      insert into public.booking_slot (booking_id, slot_date, slot)
        select v_b, c.b_date, n::text from generate_series(c.b_first, c.b_last) n;

      begin
        perform public.venue_staff_decide_booking(
          v_staff, v_b, c.decision, null, null,
          case when c.decision = 'hold' then now() + interval '3 days' end);
        v_result := 'ok';
      exception when others then
        get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text, v_detail = pg_exception_detail;
        v_result := v_code;
      end;

      v_checks := v_checks + 1;
      if v_result <> c.expect then
        v_failed := array_append(v_failed, c.label || ' (got ' || v_result || ', wanted ' || c.expect || ')');
      end if;

      -- The refusal names the clash: the other booking's event, the date and the overlapping times.
      if c.label like 'AC1 approve 10:00 after a Confirmed 07:00-09:15 is refused' then
        v_checks := v_checks + 1;
        if v_detail is null or v_detail not like '%UAT-44 Booked Harbour%' or v_detail not like '%2026-12-21%'
           or v_detail not like '%09:30%' or v_detail not like '%10:00%' then
          v_failed := array_append(v_failed, 'AC1 the refusal does not name the event, date and times: ' || coalesce(v_detail, 'no detail'));
        end if;
        -- and the booking stays Requested, so Venue Staff can still reject it
        v_checks := v_checks + 1;
        if (select status from public.booking where booking_id = v_b) <> 'Requested' then
          v_failed := array_append(v_failed, 'AC1 the refused booking did not stay Requested');
        end if;
      end if;

      raise exception 'rolled back' using errcode = 'CS999';
    exception when sqlstate 'CS999' then
      null;
    end;
  end loop;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
