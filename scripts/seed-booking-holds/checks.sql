-- Checks the database side of approving and holding by time (SPM-325 AC1-AC3, SPM-358): a refused
-- approval leaves the request to be rejected, a request still waiting blocks no hold, confirming a
-- hold keeps its times and releasing frees them at once, and a block recorded after a hold stops it
-- being confirmed but not released. Writes nothing that survives: each case is rolled back, and the
-- script ends in an error whose message is the result.
--
--   error: ok: all N checks held      every check passed. The CLI words this "failed to execute
--                                     query"; the ok: is the pass.
--   error: FAILED: <checks that did not hold>
--
-- Run against a local stack with the base seed, seed-venues and seed-venue-search-uat (it borrows
-- Test Venue Staff, Studio (no setup or turnaround) and the two UAT-44 events):
--   supabase db query --file scripts/seed-booking-holds/checks.sql --local
--
-- Every case books Studio on Monday 28 December 2026. Time is 15-minute slots: code n is n*15
-- minutes after midnight, so 28-47 is 07:00-12:00, 44-51 is 11:00-13:00 and 36-39 is 09:00-10:00.
--
-- The padded refusals (setup and turnaround) are checked by scripts/seed-venue-padding/checks.sql.

do $$
declare
  v_staff   bigint;
  v_coord   bigint;
  v_event_a bigint;
  v_event_b bigint;
  v_venue   bigint;
  v_day     date := date '2026-12-28';
  v_a       bigint;
  v_b       bigint;
  v_result  text;
  v_status  text;
  v_failed  text[] := '{}';
  v_checks  int := 0;
begin
  select user_account_id into v_staff
    from public.user_account where name = 'Test Venue Staff' and client_organisation_id is null;
  select user_account_id into v_coord
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select event_id into v_event_a from public.event where name = 'UAT-44 Booked Harbour';
  select event_id into v_event_b from public.event where name = 'UAT-44 Rejected Garden';
  select venue_id into v_venue from public.venue where location = 'Studio';
  if v_staff is null or v_coord is null or v_event_a is null or v_event_b is null or v_venue is null then
    raise exception 'Run the base seed, seed-venues and seed-venue-search-uat first';
  end if;

  -- AC1: approving B over a Confirmed A is refused and leaves B Requested; B can then be rejected.
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values (v_venue, v_event_a, v_coord) returning booking_id into v_a;
    insert into public.booking_slot (booking_id, slot_date, slot)
      select v_a, v_day, n::text from generate_series(28, 47) n;
    update public.booking set status = 'Confirmed', decided_by_user_account_id = v_staff where booking_id = v_a;
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values (v_venue, v_event_b, v_coord) returning booking_id into v_b;
    insert into public.booking_slot (booking_id, slot_date, slot)
      select v_b, v_day, n::text from generate_series(44, 51) n;

    begin
      perform public.venue_staff_decide_booking(v_staff, v_b, 'approve', null, null);
      v_result := 'ok';
    exception when others then
      get stacked diagnostics v_result = returned_sqlstate;
    end;
    select status into v_status from public.booking where booking_id = v_b;
    v_checks := v_checks + 1;
    if v_result <> 'CS082' or v_status <> 'Requested' then
      v_failed := array_append(v_failed, 'AC1 approving 11:00-13:00 over a Confirmed 07:00-12:00 is refused and stays Requested (got ' || v_result || ', ' || v_status || ')');
    end if;

    begin
      perform public.venue_staff_decide_booking(v_staff, v_b, 'reject', 'Already booked then.', null);
      v_result := 'ok';
    exception when others then
      get stacked diagnostics v_result = returned_sqlstate;
    end;
    select status into v_status from public.booking where booking_id = v_b;
    v_checks := v_checks + 1;
    if v_result <> 'ok' or v_status <> 'Rejected' then
      v_failed := array_append(v_failed, 'AC1 the refused request can still be rejected (got ' || v_result || ', ' || v_status || ')');
    end if;

    raise exception 'rolled back' using errcode = 'CS999';
  exception when sqlstate 'CS999' then
    null;
  end;

  -- AC2: a hold on B is placed over A while A is still Requested.
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values (v_venue, v_event_a, v_coord) returning booking_id into v_a;
    insert into public.booking_slot (booking_id, slot_date, slot)
      select v_a, v_day, n::text from generate_series(28, 47) n;
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values (v_venue, v_event_b, v_coord) returning booking_id into v_b;
    insert into public.booking_slot (booking_id, slot_date, slot)
      select v_b, v_day, n::text from generate_series(28, 47) n;

    begin
      perform public.venue_staff_decide_booking(v_staff, v_b, 'hold', null, null, now() + interval '3 days');
      v_result := 'ok';
    exception when others then
      get stacked diagnostics v_result = returned_sqlstate;
    end;
    select status into v_status from public.booking where booking_id = v_b;
    v_checks := v_checks + 1;
    if v_result <> 'ok' or v_status <> 'Tentative Hold' then
      v_failed := array_append(v_failed, 'AC2 a Requested booking at the same times does not block a hold (got ' || v_result || ', ' || v_status || ')');
    end if;

    raise exception 'rolled back' using errcode = 'CS999';
  exception when sqlstate 'CS999' then
    null;
  end;

  -- AC3: A is held, then confirmed or released; B at the same times is then approved.
  for v_status in select unnest(array['confirm', 'release']) loop
    begin
      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values (v_venue, v_event_a, v_coord) returning booking_id into v_a;
      insert into public.booking_slot (booking_id, slot_date, slot)
        select v_a, v_day, n::text from generate_series(28, 47) n;
      perform public.venue_staff_decide_booking(v_staff, v_a, 'hold', null, null, now() + interval '3 days');
      perform public.venue_staff_resolve_hold(v_staff, v_a, v_status);
      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values (v_venue, v_event_b, v_coord) returning booking_id into v_b;
      insert into public.booking_slot (booking_id, slot_date, slot)
        select v_b, v_day, n::text from generate_series(28, 47) n;

      begin
        perform public.venue_staff_decide_booking(v_staff, v_b, 'approve', null, null);
        v_result := 'ok';
      exception when others then
        get stacked diagnostics v_result = returned_sqlstate;
      end;
      v_checks := v_checks + 1;
      if v_status = 'confirm' and v_result <> 'CS082' then
        v_failed := array_append(v_failed, 'AC3 a confirmed hold keeps its times taken (got ' || v_result || ')');
      elsif v_status = 'release' and v_result <> 'ok' then
        v_failed := array_append(v_failed, 'AC3 a released hold frees its times at once (got ' || v_result || ')');
      end if;

      raise exception 'rolled back' using errcode = 'CS999';
    exception when sqlstate 'CS999' then
      null;
    end;
  end loop;

  -- AC3: a block over 09:00-10:00 recorded after A's hold stops it being confirmed; releasing works.
  begin
    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values (v_venue, v_event_a, v_coord) returning booking_id into v_a;
    insert into public.booking_slot (booking_id, slot_date, slot)
      select v_a, v_day, n::text from generate_series(28, 47) n;
    perform public.venue_staff_decide_booking(v_staff, v_a, 'hold', null, null, now() + interval '3 days');
    perform public.venue_staff_record_unavailability(v_staff, v_venue, 'Maintenance', null,
      (select jsonb_agg(jsonb_build_object('date', v_day, 'slot', n::text) order by n) from generate_series(36, 39) n));

    begin
      perform public.venue_staff_resolve_hold(v_staff, v_a, 'confirm');
      v_result := 'ok';
    exception when others then
      get stacked diagnostics v_result = returned_sqlstate;
    end;
    select status into v_status from public.booking where booking_id = v_a;
    v_checks := v_checks + 1;
    if v_result <> 'CS028' or v_status <> 'Tentative Hold' then
      v_failed := array_append(v_failed, 'AC3 confirming over a later block is refused and the hold stays (got ' || v_result || ', ' || v_status || ')');
    end if;

    begin
      perform public.venue_staff_resolve_hold(v_staff, v_a, 'release');
      v_result := 'ok';
    exception when others then
      get stacked diagnostics v_result = returned_sqlstate;
    end;
    select status into v_status from public.booking where booking_id = v_a;
    v_checks := v_checks + 1;
    if v_result <> 'ok' or v_status <> 'Released' then
      v_failed := array_append(v_failed, 'AC3 releasing over a later block is still allowed (got ' || v_result || ', ' || v_status || ')');
    end if;

    raise exception 'rolled back' using errcode = 'CS999';
  exception when sqlstate 'CS999' then
    null;
  end;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
