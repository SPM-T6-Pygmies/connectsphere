-- Checks the database side of venue unavailability (SPM-21, TC-VBLOCK-008):
-- the functions, the audit rows and the booking refusal. Writes nothing that
-- survives: it ends in an error, which rolls everything back, and the error
-- message is the result.
--
--   ok: all 29 checks held            every check passed
--   FAILED: <checks that did not hold>
--
-- Run against a local stack that has the base seed, seed-venues and
-- seed-venue-search-uat (it borrows Test Venue Staff, Test Coordinator, the
-- UAT-44 Harbour Room and its confirmed booking):
--   supabase db query --file scripts/seed-venue-unavailability/checks.sql --local
--
-- A block is recorded on 15-minute slots (SPM-321): 09:00-10:00 is codes 36-39. The UAT venue
-- is opened 07:00-12:00, 13:00-18:00 and 19:00-24:00 for the run, and put back by the rollback.
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
  v_request  bigint;
  v_hold     bigint;
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

  -- The venue's hours (SPM-320): the record function refuses time it is closed for.
  delete from public.venue_slot where venue_id = v_venue;
  insert into public.venue_slot (venue_id, slot_code)
  select v_venue, n::text from generate_series(28, 95) n
  where n between 28 and 47 or n between 52 and 71 or n between 76 and 95;

  -- AC9: a caller who is not Venue Staff is refused, and reads nothing
  begin
    perform public.venue_staff_record_unavailability(v_coord, v_venue, 'Renovation', null,
      jsonb_build_array(jsonb_build_object('date', v_day, 'slot', '36')));
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
       jsonb_build_array(jsonb_build_object('date', v_day, 'slot', '36'))) <> '[]'::jsonb then
    v_failed := array_append(v_failed, 'AC9 non staff could read affected bookings'); end if;

  -- AC1, AC18: record saves a row per date and 15-minute slot, In force, one audit row
  v_block := public.venue_staff_record_unavailability(v_staff, v_venue, 'Renovation', null,
    (select jsonb_agg(jsonb_build_object('date', d, 'slot', n::text) order by d, n)
       from unnest(array[v_day, v_day + 1]) d, generate_series(36, 39) n));   -- 09:00-10:00 on two days
  select count(*) into v_n from public.venue_unavailability_slot where venue_unavailability_id = v_block;
  v_checks := v_checks + 1;
  if v_n <> 8 then v_failed := array_append(v_failed, ('AC1 expected 8 date-and-slot rows, got ' || v_n)); end if;
  v_json := public.venue_staff_unavailability(v_staff, v_block);
  v_checks := v_checks + 1;
  if v_json -> 0 ->> 'status' <> 'In force' then v_failed := array_append(v_failed, 'AC1 block is not In force'); end if;
  select count(*) into v_n from public.audit_record
    where entity_type = 'venue_unavailability' and action = 'recorded' and entity_id = v_block;
  v_checks := v_checks + 1;
  if v_n <> 1 then v_failed := array_append(v_failed, ('AC18 expected 1 recorded audit row, got ' || v_n)); end if;

  -- AC14: the blocked time is busy in the busy-time read; the day after the block is not
  v_json := public.venue_busy_intervals(
    (v_day::text || ' 00:00+08')::timestamptz, ((v_day + 1)::text || ' 00:00+08')::timestamptz);
  select count(*) into v_n from jsonb_array_elements(v_json) e
    where (e ->> 'venue_id')::bigint = v_venue
      and (e ->> 'starts_at')::timestamptz >= (v_day::text || ' 09:00+08')::timestamptz
      and (e ->> 'ends_at')::timestamptz <= (v_day::text || ' 10:00+08')::timestamptz;
  v_checks := v_checks + 1;
  if v_n <> 4 then v_failed := array_append(v_failed, ('AC14 expected 4 busy quarter hours 09:00-10:00, got ' || v_n)); end if;
  v_json := public.venue_busy_intervals(
    ((v_day + 2)::text || ' 00:00+08')::timestamptz, ((v_day + 3)::text || ' 00:00+08')::timestamptz);
  select count(*) into v_n from jsonb_array_elements(v_json) e where (e ->> 'venue_id')::bigint = v_venue;
  v_checks := v_checks + 1;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC14 a day with no block is busy'); end if;

  -- AC12: a new booking whose hours the block reaches is refused with CS028 naming date and slot.
  -- The block is 09:00-10:00 and AM is 07:00-12:00: they share time, though the codes differ.
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
    values (v_venue, v_event, v_coord) returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day, 'AM');
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC12 booking over a block was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text;
    v_checks := v_checks + 1;
    if v_code <> 'CS028' or v_msg not like '%' || v_day::text || ' AM%' then
      v_failed := array_append(v_failed, ('AC12 gave ' || v_code || ' ' || v_msg)); end if;
  end;

  -- AC13: slots on the blocked day the block does not reach, and the day after the block, are accepted
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day, 'PM');
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day, 'Night');
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day + 2, 'AM');
  v_checks := v_checks + 1;

  -- AC19: an overlapping second block saves
  v_second := public.venue_staff_record_unavailability(v_staff, v_venue, 'Safety', null,
    (select jsonb_agg(jsonb_build_object('date', v_day + 1, 'slot', n::text) order by n)
       from generate_series(38, 39) n));                                       -- 09:30-10:00
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

  -- SPM-321 AC3a: a block over time the venue is closed is refused (CS078); 12:00-13:00 is the lunch gap
  begin
    perform public.venue_staff_record_unavailability(v_staff, v_venue, 'Safety', null,
      (select jsonb_agg(jsonb_build_object('date', v_day + 8, 'slot', n::text) order by n)
         from generate_series(44, 55) n));                                     -- 11:00-14:00
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'SPM-321 a block over the lunch gap was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS078' then v_failed := array_append(v_failed, ('SPM-321 closed time gave ' || v_code)); end if;
  end;
  select count(*) into v_n from public.venue_unavailability_slot where slot_date = v_day + 8 and venue_id = v_venue;
  v_checks := v_checks + 1;
  if v_n <> 0 then v_failed := array_append(v_failed, 'SPM-321 the refused block left slots behind'); end if;

  -- SPM-321: a block touching only a quarter hour of AM refuses AM, not PM; one starting as AM ends does not
  insert into public.venue_slot (venue_id, slot_code)
  select v_venue, n::text from generate_series(48, 51) n on conflict do nothing;      -- open 12:00-13:00 for this check
  v_second := public.venue_staff_record_unavailability(v_staff, v_venue, 'Safety', null,
    jsonb_build_array(jsonb_build_object('date', v_day + 5, 'slot', '47')));          -- 11:45-12:00
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
    values (v_venue, v_event, v_coord) returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day + 5, 'AM');
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'SPM-321 a quarter hour of AM was not refused');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS028' then v_failed := array_append(v_failed, ('SPM-321 quarter hour of AM gave ' || v_code)); end if;
  end;
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day + 5, 'PM');
  v_checks := v_checks + 1;
  v_second := public.venue_staff_record_unavailability(v_staff, v_venue, 'Safety', null,
    jsonb_build_array(jsonb_build_object('date', v_day + 6, 'slot', '48')));          -- 12:00-12:15
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, v_day + 6, 'AM');
  v_checks := v_checks + 1;                                                           -- accepted: it only touches AM

  -- SPM-321: approving or holding a Requested booking over a block recorded after the request is refused
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_request;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_request, v_day + 10, 'AM');
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_venue, v_event, v_coord) returning booking_id into v_hold;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_hold, v_day + 11, 'AM');
  perform public.venue_staff_decide_booking(v_staff, v_hold, 'hold', null, null, now() + interval '2 days');
  perform public.venue_staff_record_unavailability(v_staff, v_venue, 'Maintenance', null,
    (select jsonb_agg(jsonb_build_object('date', d, 'slot', n::text) order by d, n)
       from unnest(array[v_day + 10, v_day + 11]) d, generate_series(36, 39) n));
  foreach v_msg in array array['approve', 'hold'] loop
    begin
      perform public.venue_staff_decide_booking(v_staff, v_request, v_msg, null, null, now() + interval '2 days');
      v_checks := v_checks + 1; v_failed := array_append(v_failed, 'SPM-321 ' || v_msg || ' over a later block was accepted');
    exception when others then
      get stacked diagnostics v_code = returned_sqlstate;
      v_checks := v_checks + 1;
      if v_code <> 'CS028' then v_failed := array_append(v_failed, ('SPM-321 ' || v_msg || ' over a later block gave ' || v_code)); end if;
    end;
  end loop;
  begin
    perform public.venue_staff_resolve_hold(v_staff, v_hold, 'confirm');
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'SPM-321 confirming a hold over a later block was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS028' then v_failed := array_append(v_failed, ('SPM-321 confirming a hold over a later block gave ' || v_code)); end if;
  end;

  -- SPM-321: the reads give 15-minute codes earliest first, and the affected list matches by time
  v_json := public.venue_blocked_slots(v_venue, v_day + 10, v_day + 10);
  v_checks := v_checks + 1;
  if (select string_agg(e ->> 'slot', ',' order by ord) from jsonb_array_elements(v_json) with ordinality t(e, ord)) is distinct from '36,37,38,39' then
    v_failed := array_append(v_failed, 'SPM-321 the calendar read is not the quarter hours 36-39 in order'); end if;
  v_json := public.venue_staff_unavailability_affected(v_staff, v_venue,
    jsonb_build_array(jsonb_build_object('date', v_day + 10, 'slot', '36')));
  v_checks := v_checks + 1;
  if jsonb_array_length(v_json) <> 1 or v_json -> 0 ->> 'slot' <> 'AM' then
    v_failed := array_append(v_failed, 'SPM-321 a block on 09:00-09:15 does not list the AM request it sits over'); end if;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
