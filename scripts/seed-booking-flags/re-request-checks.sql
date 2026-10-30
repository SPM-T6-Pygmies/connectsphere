-- Checks the database side of re-requesting a flagged booking (SPM-251): only the assigned
-- coordinator, only a flagged booking, one waiting at a time, no clash with itself, no hold,
-- and approval replacing the original with its flags closed as replaced. Writes nothing that
-- survives: it ends in an error, which rolls everything back, and the error message is the result.
--
--   ok: all 27 checks held            every check passed
--   FAILED: <checks that did not hold>
--
-- Run against a local stack with the same fixture as checks.sql:
--   supabase db query --file scripts/seed-booking-flags/re-request-checks.sql --local
--
-- Read the message, not the exit code: `supabase db query` exits 0 even when the query fails.
-- Two sessions racing cannot be shown inside one transaction; TC-VREQ-006 in
-- docs/testing/VENUE_RE_REQUEST_MANUAL_TESTS.md does that.

do $$
declare
  f date := (now() at time zone 'Asia/Singapore')::date + 28;
  v_staff bigint;
  v_coordinator bigint;
  v_coordinator_2 bigint;
  v_main bigint;
  v_studio bigint;
  v_rooftop bigint;
  v_tech_event bigint;
  v_offsite_event bigint;
  v_tech_hall_a bigint;
  v_tech_hall_c bigint;
  v_offsite bigint;
  v_first bigint;
  v_second bigint;
  v_third bigint;
  v_n int;
  v_code text;
  v_failed text[] := '{}';
  v_checks int := 0;
  pm jsonb;
  first_hour jsonb;
  afternoon jsonb;
  late_morning jsonb;

begin
  select user_account_id into v_staff from public.user_account where name = 'Test Venue Staff';
  select user_account_id into v_coordinator from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id into v_coordinator_2 from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null;
  select venue_id into v_main from public.venue where location = 'Main Hall';
  select venue_id into v_studio from public.venue where location = 'Studio';
  select venue_id into v_rooftop from public.venue where location = 'Rooftop Terrace';
  select event_id into v_tech_event from public.event where name = 'Flag Test: Tech Summit';
  select event_id into v_offsite_event from public.event where name = 'Flag Test: Offsite Day';
  if v_staff is null or v_coordinator is null or v_coordinator_2 is null or v_tech_event is null then
    raise exception 'The fixture is missing'
      using hint = 'Run supabase db reset, seed-coordinator-view, seed-venues and seed-booking-flags first.';
  end if;
  select booking_id into v_tech_hall_a from public.booking where event_id = v_tech_event and venue_id = v_main;
  select booking_id into v_tech_hall_c from public.booking where event_id = v_tech_event and venue_id = v_studio;
  select booking_id into v_offsite from public.booking where event_id = v_offsite_event;

  -- PM is codes 52-71 (13:00-18:00); 52-55 is 13:00-14:00; 56-67 is 14:00-17:00; 44-55 is
  -- 11:00-14:00. Main Hall sets up for 30 minutes and turns around for 45 (SPM-23).
  pm := (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(52, 71) n);
  first_hour := (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(52, 55) n);
  afternoon := (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(56, 67) n);
  late_morning := (select jsonb_agg(jsonb_build_object('date', f, 'slot', n::text) order by n) from generate_series(44, 55) n);

  -- A block over each of the Tech Summit's two bookings flags both. Main Hall's covers only the
  -- first hour of the booking, so the rest of the afternoon can still be asked for there.
  perform public.venue_staff_record_unavailability(v_staff, v_main, 'Maintenance', null, first_hour);
  perform public.venue_staff_record_unavailability(v_staff, v_studio, 'Renovation', null, pm);

  -- AC1: another coordinator, and Venue Staff, are told the event does not exist (CS020).
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator_2, v_tech_event, v_rooftop, 'Banquet', pm, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS020' then v_failed := array_append(v_failed, 'AC1 another coordinator gets CS020, got ' || v_code); end if;
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_staff, v_tech_event, v_rooftop, 'Banquet', pm, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS020' then v_failed := array_append(v_failed, 'AC1 Venue Staff get CS020, got ' || v_code); end if;

  -- AC1: a booking that is not on the event named is not found (CS026).
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator, v_offsite_event, v_rooftop, 'Banquet', pm, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS026' then v_failed := array_append(v_failed, 'AC1 a booking on another event gets CS026, got ' || v_code); end if;

  -- AC1: a booking with no open flag cannot be re-requested (CS085).
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator, v_offsite_event, v_rooftop, 'Banquet', pm, v_offsite);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS085' then v_failed := array_append(v_failed, 'AC1 an unflagged booking gets CS085, got ' || v_code); end if;

  -- AC5: another booking still clashes. 11:00-14:00 at Main Hall overlaps the Workshop's AM.
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_main, 'Theatre', late_morning, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS025' then v_failed := array_append(v_failed, 'AC5 another booking still clashes (CS025), got ' || v_code); end if;

  -- AC4: the ordinary checks still apply: the blocked hour is refused (CS028).
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_main, 'Theatre', pm, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS028' then v_failed := array_append(v_failed, 'AC4 the blocked hour is refused (CS028), got ' || v_code); end if;

  -- AC3, AC4: another venue is sent, naming the booking it replaces.
  v_first := public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_rooftop, 'Banquet', pm, v_tech_hall_a);
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking
    where booking_id = v_first and status = 'Requested' and replaces_booking_id = v_tech_hall_a;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC4 the re-request is Requested and names the booking'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_tech_hall_a and status = 'Confirmed';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC4 the original stays Confirmed while it waits'); end if;

  -- AC9: a second one waits behind the first (CS086).
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_rooftop, 'Banquet', pm, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS086' then v_failed := array_append(v_failed, 'AC9 a second re-request gets CS086, got ' || v_code); end if;

  -- AC9: the index refuses a second waiting re-request written past the function.
  v_checks := v_checks + 1;
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id, status, replaces_booking_id)
    values (v_rooftop, v_tech_event, v_coordinator, 'Requested', v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> '23505' then v_failed := array_append(v_failed, 'AC9 the index refuses a second waiting re-request, got ' || v_code); end if;

  -- AC10: Venue Staff cannot hold it (CS087), and it is left Requested.
  v_checks := v_checks + 1;
  begin
    perform public.venue_staff_decide_booking(v_staff, v_first, 'hold', null, null, now() + interval '1 day');
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS087' then v_failed := array_append(v_failed, 'AC10 a hold gets CS087, got ' || v_code); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_first and status = 'Requested';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC10 a refused hold leaves it Requested'); end if;

  -- AC4: Venue Staff read the booking it replaces.
  v_checks := v_checks + 1;
  select count(*) into v_n
  from jsonb_array_elements(public.venue_staff_bookings(v_staff, 'requests', v_first)) r
  where (r -> 'replaces' ->> 'booking_id')::bigint = v_tech_hall_a and r -> 'replaces' ->> 'venue_location' = 'Main Hall'
    and r -> 'replaces' ->> 'status' = 'Confirmed';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC4 Venue Staff see which booking it replaces'); end if;

  -- AC7: rejecting it leaves the original Confirmed and flagged, and it can be re-requested again.
  perform public.venue_staff_decide_booking(v_staff, v_first, 'reject', 'Rooftop Terrace is closed that week', null);
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking b
    where b.booking_id = v_tech_hall_a and b.status = 'Confirmed' and b.replaced_by_booking_id is null
      and exists (select 1 from public.booking_review_flag fl where fl.booking_id = b.booking_id and fl.cleared_at is null);
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC7 a rejection leaves the original Confirmed and flagged'); end if;
  -- AC5: the same venue, 14:00-17:00, overlapping the original but not the block or the Gala's
  -- padded 18:30 start.
  v_second := public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_main, 'Theatre', afternoon, v_tech_hall_a);
  v_checks := v_checks + 1;
  if v_second is null then v_failed := array_append(v_failed, 'AC7 it can be re-requested again'); end if;

  -- AC5, AC6: approving it at the same venue, overlapping the original, replaces the original.
  v_checks := v_checks + 1;
  begin
    perform public.venue_staff_decide_booking(v_staff, v_second, 'approve', null, null);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'none' then v_failed := array_append(v_failed, 'AC5 approving over its own original is allowed, got ' || v_code); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_second and status = 'Confirmed';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 the re-request is Confirmed'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking
    where booking_id = v_tech_hall_a and status = 'Released' and replaced_by_booking_id = v_second;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 the original is Released and replaced by the re-request'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking_review_flag
    where booking_id = v_tech_hall_a and (cleared_how is distinct from 'replaced' or cleared_by_user_account_id <> v_staff);
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC6 every flag on the original closed as replaced, by the staff member'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.audit_record
    where entity_type = 'booking' and entity_id = v_tech_hall_a and action = 'replace' and actor_user_account_id = v_staff;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 the replacement is audited'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from jsonb_array_elements(public.coordinator_event_flags(v_coordinator, v_tech_event)) fl
    where (fl ->> 'booking_id')::bigint = v_tech_hall_a;
  if v_n <> 0 then v_failed := array_append(v_failed, 'AC6 the original no longer shows a flag'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.coordinator_event_bookings(v_coordinator, v_tech_event) eb
    where eb.booking_id = v_tech_hall_a and eb.replaced_by_booking_id = v_second;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 the coordinator reads the replaced-by link'); end if;

  -- AC8: the event's other flagged booking is untouched.
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking b
    where b.booking_id = v_tech_hall_c and b.status = 'Confirmed'
      and exists (select 1 from public.booking_review_flag fl where fl.booking_id = b.booking_id and fl.cleared_at is null);
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC8 the Studio booking keeps its status and flag'); end if;

  -- AC1: the replaced original has nothing left to re-request (CS085).
  v_checks := v_checks + 1;
  begin
    perform public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_rooftop, 'Banquet', pm, v_tech_hall_a);
    v_code := 'none';
  exception when others then v_code := sqlstate; end;
  if v_code <> 'CS085' then v_failed := array_append(v_failed, 'AC1 a replaced booking gets CS085, got ' || v_code); end if;

  -- AC6: an original cancelled while its re-request waited is left as it is on approval.
  v_third := public.coordinator_submit_booking_request(v_coordinator, v_tech_event, v_rooftop, 'Banquet', pm, v_tech_hall_c);
  perform public.coordinator_cancel_booking(v_coordinator, v_tech_hall_c);
  perform public.venue_staff_decide_booking(v_staff, v_third, 'approve', null, null);
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking where booking_id = v_third and status = 'Confirmed';
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 a re-request for a cancelled original is still Confirmed'); end if;
  v_checks := v_checks + 1;
  select count(*) into v_n from public.booking
    where booking_id = v_tech_hall_c and status = 'Released' and replaced_by_booking_id is null;
  if v_n <> 1 then v_failed := array_append(v_failed, 'AC6 a cancelled original is not marked replaced'); end if;

  -- Only the functions write: a signed-in user cannot set the links directly.
  v_checks := v_checks + 1;
  begin
    set local role authenticated;
    update public.booking set replaced_by_booking_id = v_first where booking_id = v_offsite;
    get diagnostics v_n = row_count;
    v_code := case when v_n = 0 then 'no rows' else 'none' end;
  exception when others then v_code := sqlstate; end;
  reset role;
  if v_code not in ('42501', 'no rows') then v_failed := array_append(v_failed, 'a direct write is refused, got ' || v_code); end if;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end $$;
