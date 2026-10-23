-- Checks the database side of booking flags (SPM-313): flagging when a block is saved,
-- one reason per block, nothing else changing, the lift note, and who can read what.
-- Writes nothing that survives: it ends in an error, which rolls everything back, and
-- the error message is the result.
--
--   ok: all 40 checks held            every check passed (38 on a slot table without SPM-331's
--                                     15-minute codes, which add two overlap-by-time checks)
--   FAILED: <checks that did not hold>
--
-- A block is recorded on 15-minute codes (SPM-321): AM is codes 28-47, PM 52-71, Night 76-95.
--
-- Run against a local stack that has the base seed, seed-venues and seed-booking-flags:
--   supabase db query --file scripts/seed-booking-flags/checks.sql --local
--
-- Read the message, not the exit code: `supabase db query` exits 0 even when the query
-- fails. Dates are relative to today so it never goes stale. It records its blocks on
-- the days seed.sql books (F = 28 days out), so run teardown.sql then seed.sql first if
-- you have recorded blocks there by hand.

do $$
declare
  f date := (now() at time zone 'Asia/Singapore')::date + 28;
  v_staff bigint;
  v_coordinator bigint;
  v_coordinator_2 bigint;
  v_main bigint;
  v_studio bigint;
  v_rooftop bigint;
  v_block1 bigint;
  v_block2 bigint;
  v_block3 bigint;
  v_tech_hall_a bigint;
  v_tech_hall_c bigint;
  v_offsite bigint;
  v_quiz bigint;
  v_workshop bigint;
  v_gala bigint;
  v_second bigint;
  v_live_hold bigint;
  v_lapsed_hold bigint;
  v_tech_event bigint;
  v_n int;
  v_text text;
  v_json jsonb;
  v_code text;
  v_failed text[] := '{}';
  v_checks int := 0;

begin
  select user_account_id into v_staff from public.user_account where name = 'Test Venue Staff';
  select user_account_id into v_coordinator from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id into v_coordinator_2 from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null;
  select venue_id into v_main from public.venue where location = 'Main Hall';
  select venue_id into v_studio from public.venue where location = 'Studio';
  select venue_id into v_rooftop from public.venue where location = 'Rooftop Terrace';
  select event_id into v_tech_event from public.event where name = 'Flag Test: Tech Summit';
  if v_staff is null or v_coordinator is null or v_coordinator_2 is null or v_tech_event is null then
    raise exception 'The fixture is missing'
      using hint = 'Run supabase db reset, seed-coordinator-view, seed-venues and seed-booking-flags first.';
  end if;

  select b.booking_id into v_tech_hall_a from public.booking b join public.booking_slot bs using (booking_id)
    where b.event_id = v_tech_event and b.venue_id = v_main;
  select b.booking_id into v_tech_hall_c from public.booking b join public.booking_slot bs using (booking_id)
    where b.event_id = v_tech_event and b.venue_id = v_studio;
  select b.booking_id into v_offsite from public.booking b join public.event e using (event_id)
    where e.name = 'Flag Test: Offsite Day';
  select b.booking_id into v_quiz from public.booking b join public.event e using (event_id)
    where e.name = 'Flag Test: Quiz';
  select b.booking_id into v_workshop from public.booking b join public.event e using (event_id)
    where e.name = 'Flag Test: Workshop';
  select b.booking_id into v_gala from public.booking b join public.event e using (event_id)
    where e.name = 'Flag Test: Gala';
  select b.booking_id into v_second from public.booking b join public.event e using (event_id)
    where e.name = 'Flag Test: Second Event';
  select b.booking_id into v_live_hold from public.booking b join public.booking_slot bs using (booking_id)
    where b.venue_id = v_studio and bs.slot_date = f + 2;
  select b.booking_id into v_lapsed_hold from public.booking b join public.booking_slot bs using (booking_id)
    where b.venue_id = v_studio and bs.slot_date = f + 3;

  -- 1. A block over Main Hall on F PM flags the Confirmed booking there, with its day and hours.
  v_block1 := public.venue_staff_record_unavailability(
    v_staff, v_main, 'Maintenance', null,
    (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(52, 71) n));
  v_checks := v_checks + 1;
  select detail into v_text from public.booking_review_flag
    where booking_id = v_tech_hall_a and cleared_at is null;
  if v_text is distinct from 'Maintenance: ' || f || ' 13:00 to 18:00' then
    v_failed := array_append(v_failed, 'AC1 detail names the day, hours and reason'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag
    where booking_id = v_tech_hall_a and reason_code = 'venue-unavailable'
      and source_ref = v_block1::text and cleared_at is null and flagged_at > now() - interval '1 minute';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC1 one open reason, flagged just now'); end if;

  -- 2. Only what the block overlaps: other slots, other days, other venues, and a Requested booking.
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag
    where booking_id in (v_workshop, v_gala, v_quiz, v_offsite, v_tech_hall_c);
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC2 other slots, days and venues are not flagged'); end if;
  -- A block over a Requested booking's slot flags nothing: Venue Staff cannot approve it over the block.
  perform public.venue_staff_record_unavailability(
    v_staff, v_rooftop, 'Renovation', null,
    (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(52, 71) n));
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_second;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC1 a Requested booking is not flagged'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_second and status = 'Requested';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC1 the Requested booking is left Requested'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag f
    join public.booking b using (booking_id) join public.event e using (event_id)
    where e.name like 'Flag Test: %';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC2 exactly one booking flagged by the first block'); end if;

  -- 3. Nothing else changes.
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking
    where booking_id in (v_tech_hall_a, v_tech_hall_c, v_offsite, v_quiz, v_workshop, v_gala) and status = 'Confirmed';
  if v_n <> 6 then v_failed := array_append(v_failed, 'AC3 bookings keep their status'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.event where event_id = v_tech_event and status = 'Planning';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC3 the event keeps its status'); end if;

  -- 4. Holds: a live hold is flagged, a lapsed one is marked Expired and not flagged.
  perform public.venue_staff_record_unavailability(
    v_staff, v_studio, 'Safety', null,
    (select jsonb_agg(jsonb_build_object('date', f + d, 'slot', n::text) order by d, n) from generate_series(2, 3) d, generate_series(52, 71) n));
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_live_hold;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC1 a live hold is flagged'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_live_hold and status = 'Tentative Hold';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC3 the flagged hold stays a hold'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_lapsed_hold;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC1 a lapsed hold is not flagged'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_lapsed_hold and status = 'Expired';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC1 the lapsed hold is marked Expired first'); end if;

  -- 5. Stacked blocks: one reason per block.
  v_block2 := public.venue_staff_record_unavailability(
    v_staff, v_main, 'Equipment failure', null,
    (select jsonb_agg(jsonb_build_object('date', f + d, 'slot', n::text) order by d, n) from generate_series(0, 8) d, generate_series(52, 71) n));
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and cleared_at is null;
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC5 two blocks give Tech Summit two reasons'); end if;
  v_checks := v_checks + 1;
  select count(distinct source_ref) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a;
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC5 each reason names its own block'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id in (v_offsite, v_quiz) and source_ref = v_block2::text;
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC5 Offsite Day and the Quiz carry one reason each'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id in (v_workshop, v_gala, v_second);
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC2 the Workshop, Gala and Requested booking still have none'); end if;

  -- 6. The same reason cannot be added to an open flag twice.
  v_checks := v_checks + 1;
  begin
    insert into public.booking_review_flag (booking_id, reason_code, source_ref, detail)
    values (v_tech_hall_a, 'venue-unavailable', v_block1::text, 'duplicate');
    v_failed := array_append(v_failed, 'AC5 a second open row for the same block is refused');
  exception when unique_violation then
    null;
  end;

  -- 7. Lifting a block keeps the flag and says so; the other block's reason is unchanged.
  perform public.venue_staff_lift_unavailability(v_staff, v_block1);
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and cleared_at is null;
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC6 a lift does not clear a flag'); end if;
  v_checks := v_checks + 1;
  select detail into v_text from public.booking_review_flag
    where booking_id = v_tech_hall_a and source_ref = v_block1::text;
  if v_text is distinct from 'Maintenance: ' || f || ' 13:00 to 18:00' then
    v_failed := array_append(v_failed, 'AC6 a lift leaves the reason text as it was'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n
    from jsonb_array_elements(public.coordinator_event_flags(v_coordinator, v_tech_event)) x
    where (x ->> 'booking_id')::bigint = v_tech_hall_a
      and ((x ->> 'detail') like 'Maintenance:%') = ((x ->> 'source_lifted_at') is not null);
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC6 the read says the lifted block was lifted, and the other block was not'); end if;
  v_checks := v_checks + 1;
  select detail into v_text from public.booking_review_flag
    where booking_id = v_tech_hall_a and source_ref = v_block2::text;
  if v_text is distinct from 'Equipment failure: ' || f || ' 13:00 to 18:00' then
    v_failed := array_append(v_failed, 'AC6 the other block''s reason text is unchanged'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_tech_hall_a and status = 'Confirmed';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 the booking is still Confirmed'); end if;

  -- 8. A lifted block flags nothing new, and a block over nothing flags nothing.
  v_block3 := public.venue_staff_record_unavailability(
    v_staff, v_main, 'Other', 'Nothing booked',
    (select jsonb_agg(jsonb_build_object('date', f + 12, 'slot', n::text) order by n) from generate_series(28, 47) n));
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where source_ref = v_block3::text;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC1 a block over no booking flags nothing'); end if;

  -- 9. Who reads what.
  v_checks := v_checks + 1;
  v_json := public.coordinator_event_flags(v_coordinator, v_tech_event);
  if jsonb_array_length(v_json) <> 2
     or (v_json -> 0 ->> 'venue_location') <> 'Main Hall' or (v_json -> 0 ->> 'status') <> 'Confirmed' then
    v_failed := array_append(v_failed, 'AC4 the Coordinator reads two flags on their event, with the booking''s venue and status'); end if;
  v_checks := v_checks + 1;
  if (v_json -> 0 -> 'slots' -> 0 ->> 'slot') <> 'PM' or (v_json -> 0 ->> 'flagged_at') is null then
    v_failed := array_append(v_failed, 'AC4 each flag carries the booking''s slots and when it was flagged'); end if;
  v_checks := v_checks + 1;
  if public.coordinator_event_flags(v_coordinator_2, v_tech_event) <> '[]'::jsonb then
    v_failed := array_append(v_failed, 'AC4 another coordinator reads nothing'); end if;
  v_checks := v_checks + 1;
  v_json := public.venue_staff_block_flagged_bookings(v_staff, v_block1);
  if jsonb_array_length(v_json) <> 1
     or (v_json -> 0 ->> 'coordinator_user_account_id')::bigint <> v_coordinator
     or (v_json -> 0 ->> 'event_name') <> 'Flag Test: Tech Summit' then
    v_failed := array_append(v_failed, 'Venue Staff read which bookings a block flagged, and whose they are'); end if;
  v_checks := v_checks + 1;
  if public.venue_staff_block_flagged_bookings(v_coordinator, v_block1) <> '[]'::jsonb then
    v_failed := array_append(v_failed, 'a coordinator cannot read a block''s flagged bookings'); end if;

  -- 9b. A flag ends with its booking: cancelling it (-> Released) closes its flags as
  --     'booking-ended', and it drops out of what the coordinator reads.
  v_checks := v_checks + 1;
  select event_id into v_tech_event from public.booking where booking_id = v_offsite;
  if jsonb_array_length(public.coordinator_event_flags(v_coordinator, v_tech_event)) <> 1 then
    v_failed := array_append(v_failed, 'AC4 Offsite Day shows its flag while the booking is Confirmed'); end if;
  update public.booking set status = 'Released' where booking_id = v_offsite;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag
    where booking_id = v_offsite and cleared_how = 'booking-ended' and cleared_at is not null
      and cleared_by_user_account_id is null;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC8 cancelling a booking closes its flag as booking-ended'); end if;
  v_checks := v_checks + 1;
  if public.coordinator_event_flags(v_coordinator, v_tech_event) <> '[]'::jsonb then
    v_failed := array_append(v_failed, 'AC8 a Released booking''s flag is not shown'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and cleared_at is null;
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC8 the event''s other booking keeps its flags'); end if;
  select event_id into v_tech_event from public.event where name = 'Flag Test: Tech Summit';
  -- A live hold that expires closes its flag too.
  v_checks := v_checks + 1;
  update public.booking set status = 'Expired' where booking_id = v_live_hold;
  select count(*) into v_n from public.booking_review_flag
    where booking_id = v_live_hold and cleared_how = 'booking-ended';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC8 a hold that expires closes its flag'); end if;
  -- A flag the coordinator already cleared is not overwritten when the booking ends later.
  v_checks := v_checks + 1;
  update public.booking_review_flag set cleared_at = now(), cleared_by_user_account_id = v_coordinator, cleared_how = 'coordinator'
    where booking_id = v_quiz and cleared_at is null;
  update public.booking set status = 'Released' where booking_id = v_quiz;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_quiz and cleared_how = 'coordinator';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC8 a flag already cleared by the coordinator is left as it was'); end if;

  -- 9c. Overlap is by time, not by slot code, and the reason is the block's own hours: a block on
  --     the 15-minute codes of SPM-331 flags a booking made on AM/PM/Night when it shares time
  --     with it, joined where the codes run into each other, and not when it only touches.
  --     Skipped until the slot table has those codes.
  if exists (select 1 from public.slot where slot_code = '48') then
    -- Main Hall is closed 12:00-13:00; open it for this check so a block can start exactly as AM ends.
    insert into public.venue_slot (venue_id, slot_code)
    select v_main, n::text from generate_series(48, 51) n on conflict do nothing;
    v_checks := v_checks + 1;
    v_block3 := public.venue_staff_record_unavailability(
      v_staff, v_main, 'Safety', null,
      jsonb_build_array(jsonb_build_object('date', f, 'slot', '48')));     -- 12:00-12:15, AM ends at 12:00
    select count(*) into v_n from public.booking_review_flag where booking_id = v_workshop and source_ref = v_block3::text;
    if v_n <> 0 then v_failed := array_append(v_failed, 'a 15-minute block that only touches the AM slot flags nothing'); end if;
    v_checks := v_checks + 1;
    v_block3 := public.venue_staff_record_unavailability(
      v_staff, v_main, 'Safety', null,
      jsonb_build_array(jsonb_build_object('date', f, 'slot', '46'), jsonb_build_object('date', f, 'slot', '47')));
    select detail into v_text from public.booking_review_flag where booking_id = v_workshop and source_ref = v_block3::text;
    if v_text is distinct from 'Safety: ' || f || ' 11:30 to 12:00' then
      v_failed := array_append(v_failed, 'two 15-minute slots inside the AM slot flag the AM booking, naming the block''s 11:30 to 12:00'); end if;
  end if;
  v_checks := v_checks + 1;
  if public.merge_time_spans('[{"date":"2026-11-06","start":"13:00","end":"13:15"},{"date":"2026-11-06","start":"13:15","end":"18:00"},{"date":"2026-11-07","start":"07:00","end":"12:00"}]'::jsonb)
     is distinct from '2026-11-06 13:00 to 18:00, 2026-11-07 07:00 to 12:00' then
    v_failed := array_append(v_failed, 'slots that run into each other read as one span'); end if;

  -- 10. Only Venue Staff can record a block.
  v_checks := v_checks + 1;
  begin
    perform public.venue_staff_record_unavailability(
      v_coordinator, v_main, 'Maintenance', null,
      (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(52, 71) n));
    v_failed := array_append(v_failed, 'only Venue Staff can record a block');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> 'CS036' then v_failed := array_append(v_failed, 'only Venue Staff can record a block (CS036)'); end if;
  end;

  -- 11. A cleared row is history, and a booking is flagged again if the cause comes back.
  v_checks := v_checks + 1;
  update public.booking_review_flag
    set cleared_at = now(), cleared_by_user_account_id = v_coordinator, cleared_how = 'coordinator'
    where booking_id = v_tech_hall_a and source_ref = v_block2::text;
  insert into public.booking_review_flag (booking_id, reason_code, source_ref, detail)
    values (v_tech_hall_a, 'venue-unavailable', v_block2::text, 'again');
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and source_ref = v_block2::text;
  if v_n <> 2 then v_failed := array_append(v_failed, 'a cleared reason stays as history beside a new open one'); end if;
  v_checks := v_checks + 1;
  begin
    update public.booking_review_flag set cleared_at = now() where booking_id = v_tech_hall_a and source_ref = v_block2::text and cleared_at is null;
    v_failed := array_append(v_failed, 'a cleared row must say how it was cleared');
  exception when check_violation then
    null;
  end;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end $$;
