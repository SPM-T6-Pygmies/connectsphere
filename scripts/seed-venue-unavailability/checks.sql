-- Checks the database side of venue unavailability (SPM-21, TC-VBLOCK-008):
-- the functions, the audit rows and the booking refusal. Writes nothing that
-- survives: it ends in an error, which rolls everything back, and the error
-- message is the result.
--
--   ok: all 19 checks held            every check passed
--   FAILED: <checks that did not hold>
--
-- Run against a local stack that has the base seed, seed-venues and
-- seed-venue-search-uat (it borrows Test Venue Staff, Test Coordinator, the
-- UAT-44 Harbour Room and its confirmed booking):
--   supabase db query --file scripts/seed-venue-unavailability/checks.sql --local
--
-- Read the message, not the exit code: `supabase db query` exits 0 even when
-- the query fails. Dates are relative to today so it never goes stale.

do $$
declare
  v_staff    bigint;
  v_coord    bigint;
  v_venue    bigint;
  v_event    bigint;
  v_day      date := (now() at time zone 'Asia/Singapore')::date + 40;
  v_block    bigint;
  v_second   bigint;
  v_booking  bigint;
  v_code     text;
  v_msg      text;
  v_n        int;
  v_json     jsonb;
  v_failed   text[] := '{}';
  v_checks   int := 0;
begin
  select user_account_id into v_staff
    from public.user_account where name = 'Test Venue Staff' and client_organisation_id is null;
  select user_account_id into v_coord
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select venue_id into v_venue from public.venue where location = 'UAT-44 Harbour Room';
  select e.event_id into v_event from public.event e where e.name = 'UAT-44 Booked Harbour';
  if v_staff is null or v_coord is null or v_venue is null or v_event is null then
    raise exception 'Run the base seed, seed-venues and seed-venue-search-uat first';
  end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);

  -- AC9: a caller who is not Venue Staff is refused, and reads nothing
  begin
    perform public.venue_staff_record_unavailability(v_coord, v_venue, 'Renovation', null,
      jsonb_build_array(jsonb_build_object('date', v_day, 'slot', 'AM')));
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC9 record by non staff was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS036' then v_failed := array_append(v_failed, ('AC9 record by non staff gave ' || v_code)); end if;
  end;
  v_checks := v_checks + 2;
  if public.venue_staff_unavailability(v_coord, null) <> '[]'::jsonb then
    v_failed := array_append(v_failed, 'AC9 non staff could list blocks'); end if;
  if public.venue_staff_unavailability_affected(v_coord, v_venue,
       jsonb_build_array(jsonb_build_object('date', v_day, 'slot', 'AM'))) <> '[]'::jsonb then
    v_failed := array_append(v_failed, 'AC9 non staff could read affected bookings'); end if;

  -- AC1, AC18: record saves a row per date and slot, In force, one audit row
  v_block := public.venue_staff_record_unavailability(v_staff, v_venue, 'Renovation', null,
    jsonb_build_array(jsonb_build_object('date', v_day, 'slot', 'AM'),
                      jsonb_build_object('date', v_day, 'slot', 'PM'),
                      jsonb_build_object('date', v_day + 1, 'slot', 'AM'),
                      jsonb_build_object('date', v_day + 1, 'slot', 'PM')));
  select count(*) into v_n from public.venue_unavailability_slot where venue_unavailability_id = v_block;
  v_checks := v_checks + 1;
  if v_n <> 4 then v_failed := array_append(v_failed, ('AC1 expected 4 date-and-slot rows, got ' || v_n)); end if;
  v_json := public.venue_staff_unavailability(v_staff, v_block);
  v_checks := v_checks + 1;
  if v_json -> 0 ->> 'status' <> 'In force' then v_failed := array_append(v_failed, 'AC1 block is not In force'); end if;
  select count(*) into v_n from public.audit_record
    where entity_type = 'venue_unavailability' and action = 'recorded' and entity_id = v_block;
  v_checks := v_checks + 1;
  if v_n <> 1 then v_failed := array_append(v_failed, ('AC18 expected 1 recorded audit row, got ' || v_n)); end if;

  -- AC14: the blocked slot is busy in the busy-time read; the day after the block is not
  v_json := public.venue_busy_intervals(
    (v_day::text || ' 00:00+08')::timestamptz, ((v_day + 1)::text || ' 00:00+08')::timestamptz);
  select count(*) into v_n from jsonb_array_elements(v_json) e
    where (e ->> 'venue_id')::bigint = v_venue
      and (e ->> 'starts_at')::timestamptz = (v_day::text || ' 07:00+08')::timestamptz;
  v_checks := v_checks + 1;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC14 blocked slot is not busy'); end if;
  v_json := public.venue_busy_intervals(
    ((v_day + 2)::text || ' 00:00+08')::timestamptz, ((v_day + 3)::text || ' 00:00+08')::timestamptz);
  select count(*) into v_n from jsonb_array_elements(v_json) e where (e ->> 'venue_id')::bigint = v_venue;
  v_checks := v_checks + 1;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC14 a day with no block is busy'); end if;

  -- AC12: a new booking over the blocked slot is refused with CS028 naming date and slot
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
    values (v_venue, v_event, v_coord) returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day, 'PM');
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC12 booking over a block was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text;
    v_checks := v_checks + 1;
    if v_code <> 'CS028' or v_msg not like '%' || v_day::text || ' PM%' then
      v_failed := array_append(v_failed, ('AC12 gave ' || v_code || ' ' || v_msg)); end if;
  end;

  -- AC13: another slot on the blocked day, and the day after the block, are accepted
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day, 'Night');
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day + 2, 'AM');
  v_checks := v_checks + 1;

  -- AC19: an overlapping second block saves
  v_second := public.venue_staff_record_unavailability(v_staff, v_venue, 'Safety', null,
    jsonb_build_array(jsonb_build_object('date', v_day + 1, 'slot', 'AM')));
  v_checks := v_checks + 1;
  if v_second is null then v_failed := array_append(v_failed, 'AC19 overlapping block was not saved'); end if;

  -- AC15, AC16, AC18: lift the first; the slot the second still covers stays refused
  perform public.venue_staff_lift_unavailability(v_staff, v_block);
  v_json := public.venue_staff_unavailability(v_staff, v_block);
  v_checks := v_checks + 1;
  if v_json -> 0 ->> 'status' <> 'Lifted' or v_json -> 0 ->> 'lifted_by_name' <> 'Test Venue Staff' then
    v_failed := array_append(v_failed, 'AC16 lifted block is not shown as Lifted with who'); end if;
  select count(*) into v_n from public.audit_record
    where entity_type = 'venue_unavailability' and action = 'lifted' and entity_id = v_block;
  v_checks := v_checks + 1;
  if v_n <> 1 then v_failed := array_append(v_failed, ('AC18 expected 1 lifted audit row, got ' || v_n)); end if;
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
    values (v_venue, v_event, v_coord) returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day + 1, 'AM');
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC15 slot another block covers was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS028' then v_failed := array_append(v_failed, ('AC15 gave ' || v_code)); end if;
  end;
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day, 'AM');
  v_checks := v_checks + 1;

  -- AC17: lifting twice is refused
  begin
    perform public.venue_staff_lift_unavailability(v_staff, v_block);
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC17 a second lift was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS038' then v_failed := array_append(v_failed, ('AC17 gave ' || v_code)); end if;
  end;

  -- AC9: a caller who is not Venue Staff cannot lift
  begin
    perform public.venue_staff_lift_unavailability(v_coord, v_second);
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC9 lift by non staff was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS036' then v_failed := array_append(v_failed, ('AC9 lift by non staff gave ' || v_code)); end if;
  end;

  -- AC10, AC11: the confirmed booking is untouched and listed as affected
  select count(*) into v_n from public.booking where event_id = v_event and status = 'Confirmed';
  v_checks := v_checks + 1;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC10 the confirmed booking changed'); end if;
  v_json := public.venue_staff_unavailability_affected(v_staff, v_venue,
    (select jsonb_agg(jsonb_build_object('date', slot_date, 'slot', slot))
       from public.booking_slot bs join public.booking b using (booking_id)
      where b.event_id = v_event and b.status = 'Confirmed'));
  v_checks := v_checks + 1;
  if jsonb_array_length(v_json) <> 1 or v_json -> 0 ->> 'event_name' <> 'UAT-44 Booked Harbour' then
    v_failed := array_append(v_failed, 'AC11 the confirmed booking is not listed as affected'); end if;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
