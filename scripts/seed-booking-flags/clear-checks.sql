-- Checks the database side of clearing a flag (SPM-310): only the assigned coordinator,
-- every reason on the one booking, kept as history, flagged again by a later block, and
-- nothing to clear refused. Writes nothing that survives: it ends in an error, which rolls
-- everything back, and the error message is the result.
--
--   ok: all 14 checks held            every check passed
--   FAILED: <checks that did not hold>
--
-- Run against a local stack with the same fixture as checks.sql:
--   supabase db query --file scripts/seed-booking-flags/clear-checks.sql --local
--
-- Read the message, not the exit code: `supabase db query` exits 0 even when the query fails.

do $$
declare
  f date := (now() at time zone 'Asia/Singapore')::date + 28;
  v_staff bigint;
  v_coordinator bigint;
  v_coordinator_2 bigint;
  v_main bigint;
  v_studio bigint;
  v_tech_event bigint;
  v_tech_hall_a bigint;
  v_tech_hall_c bigint;
  v_offsite bigint;
  v_n int;
  v_json jsonb;
  v_code text;
  v_failed text[] := '{}';
  v_checks int := 0;
  pm jsonb;

begin
  select user_account_id into v_staff from public.user_account where name = 'Test Venue Staff';
  select user_account_id into v_coordinator from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id into v_coordinator_2 from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null;
  select venue_id into v_main from public.venue where location = 'Main Hall';
  select venue_id into v_studio from public.venue where location = 'Studio';
  select event_id into v_tech_event from public.event where name = 'Flag Test: Tech Summit';
  if v_staff is null or v_coordinator is null or v_coordinator_2 is null or v_tech_event is null then
    raise exception 'The fixture is missing'
      using hint = 'Run supabase db reset, seed-coordinator-view, seed-venues and seed-booking-flags first.';
  end if;
  select booking_id into v_tech_hall_a from public.booking where event_id = v_tech_event and venue_id = v_main;
  select booking_id into v_tech_hall_c from public.booking where event_id = v_tech_event and venue_id = v_studio;
  select b.booking_id into v_offsite from public.booking b join public.event e using (event_id)
    where e.name = 'Flag Test: Offsite Day';

  -- Two blocks over the Tech Summit's Main Hall booking, one over its Studio booking.
  pm := jsonb_build_array(jsonb_build_object('date', f, 'slot', 'PM'));
  perform public.venue_staff_record_unavailability(v_staff, v_main, 'Maintenance', null, pm);
  perform public.venue_staff_record_unavailability(v_staff, v_main, 'Safety', null, pm);
  perform public.venue_staff_record_unavailability(v_staff, v_studio, 'Renovation', null, pm);

  -- AC3: another coordinator, and Venue Staff, are told there is no such booking.
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_clear_booking_flags(v_coordinator_2, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS026' then v_failed := array_append(v_failed, 'AC3 another coordinator gets CS026, got ' || v_code); end if;
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_clear_booking_flags(v_staff, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS026' then v_failed := array_append(v_failed, 'AC3 Venue Staff get CS026, got ' || v_code); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and cleared_at is null;
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC3 a refused clear leaves both reasons open'); end if;

  -- AC1: the assigned coordinator clears every reason on the booking; its status stays.
  perform public.coordinator_clear_booking_flags(v_coordinator, v_tech_hall_a);
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and cleared_at is null;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC1 no reason is left open'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_tech_hall_a and status = 'Confirmed';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC1 the booking stays Confirmed'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.event where event_id = v_tech_event and status = 'Planning';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC1 the event keeps its status'); end if;

  -- AC2: both rows are kept, with their reasons, and say who cleared them, when and how.
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag
    where booking_id = v_tech_hall_a
      and cleared_how = 'coordinator'
      and cleared_by_user_account_id = v_coordinator
      and cleared_at > now() - interval '1 minute'
      and detail in ('Maintenance: ' || f || ' 13:00 to 18:00', 'Safety: ' || f || ' 13:00 to 18:00');
  if v_n <> 2 then v_failed := array_append(v_failed, 'AC2 two cleared rows record who, when, how and which reason'); end if;

  -- AC4: the event's other booking keeps its flag, and the page lists only that one.
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_c and cleared_at is null;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC4 the Studio booking stays flagged'); end if;
  v_checks := v_checks + 1;
  v_json := public.coordinator_event_flags(v_coordinator, v_tech_event);
  if jsonb_array_length(v_json) <> 1 or (v_json -> 0 ->> 'booking_id')::bigint <> v_tech_hall_c then
    v_failed := array_append(v_failed, 'AC4 the event page lists only the Studio flag'); end if;

  -- AC6: nothing left to clear, or never flagged, is refused.
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_clear_booking_flags(v_coordinator, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC6 a second clear gets CS080, got ' || v_code); end if;
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_clear_booking_flags(v_coordinator, v_offsite);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC6 an unflagged booking gets CS080, got ' || v_code); end if;

  -- AC5: a later block over the booking flags it again, with only the new reason open.
  perform public.venue_staff_record_unavailability(v_staff, v_main, 'Equipment failure', null, pm);
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag
    where booking_id = v_tech_hall_a and cleared_at is null and detail like 'Equipment failure: %';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC5 a later block flags it again'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag where booking_id = v_tech_hall_a and cleared_at is null;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC5 the cleared reasons stay cleared'); end if;

  -- AC6: a booking that has ended has nothing to clear (its flags closed with it, SPM-313 AC8).
  perform public.coordinator_cancel_booking(v_coordinator, v_tech_hall_c);
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_clear_booking_flags(v_coordinator, v_tech_hall_c);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC6 a cancelled booking gets CS080, got ' || v_code); end if;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end $$;
