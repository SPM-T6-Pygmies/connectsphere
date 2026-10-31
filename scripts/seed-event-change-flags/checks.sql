-- Checks the database side of SPM-309: when the assigned Event Coordinator accepts a field of a
-- change request, the event's live venue bookings are flagged (`event-change`), and a field that
-- is declined, or that does not touch a venue booking, flags nothing. Each case builds its own
-- event, bookings and change request, decides it through `coordinator_decide_change_request`, and
-- is rolled back. The script ends in an error whose message is the result.
--
--   error: ok: all N checks held      every check passed. The CLI words this "failed to execute
--                                     query"; the ok: is the pass.
--   error: FAILED: <checks that did not hold>
--
-- Run against a local stack with the base seed, seed-venues and seed-venue-search-uat (it borrows
-- Test Coordinator, Test Organiser and the venues):
--   supabase db query --file scripts/seed-event-change-flags/checks.sql --local
--
-- The bookings of each event: B1 Confirmed at Main Hall and B2 an unexpired hold at Studio (live,
-- both 13:00-18:00 on Thursday 3 December 2026), B3 Requested at Rooftop Terrace, B4 a hold that
-- lapsed an hour ago at UAT-44 Harbour Room, B5 Rejected at UAT-44 Garden Hall, and B6 Confirmed at
-- Main Hall on 20 October 2026, already over. Only B1 and B2 are live. A seventh booking, at Main
-- Hall on Friday 4 December, belongs to another event and is never flagged.

do $$
declare
  v_coord     bigint;
  v_organiser bigint;
  v_org       bigint;
  v_event     bigint;
  v_other     bigint;
  v_request   bigint;
  v_b         bigint[];
  v_main      bigint; v_studio bigint; v_rooftop bigint; v_harbour bigint; v_garden bigint;
  c           record;
  v_flagged   text;
  v_details   text;
  v_status    text;
  i           int;
  v_failed    text[] := '{}';
  v_checks    int := 0;

begin
  select ua.user_account_id into v_coord
    from public.user_account ua where ua.name = 'Test Coordinator' and ua.client_organisation_id is null;
  select user_account_id, client_organisation_id into v_organiser, v_org
    from public.user_account where name = 'Test Organiser';
  select venue_id into v_main    from public.venue where location = 'Main Hall';
  select venue_id into v_studio  from public.venue where location = 'Studio';
  select venue_id into v_rooftop from public.venue where location = 'Rooftop Terrace';
  select venue_id into v_harbour from public.venue where location = 'UAT-44 Harbour Room';
  select venue_id into v_garden  from public.venue where location = 'UAT-44 Garden Hall';
  if v_coord is null or v_organiser is null or v_main is null or v_garden is null then
    raise exception 'Run the base seed, seed-venues and seed-venue-search-uat first';
  end if;

  for c in
    select * from (values
      -- label, decisions as field=Accepted|Rejected (a Rejected one carries a reason), expected flagged bookings (B1..B6), expected detail
      ('AC1 accepted times flag every live booking', 'times=Accepted', 'B1,B2', 'Event date/time changed'),
      ('AC2 accepted attendance flags them, naming the field', 'expected_attendance=Accepted', 'B1,B2', 'Expected attendance changed from 120 to 150'),
      ('AC2 accepted venue requirements flag them, naming the field', 'venue_requirements=Accepted', 'B1,B2', 'Venue requirements changed'),
      ('AC3 an accepted equipment change alone flags nothing', 'equipment_requirements=Accepted', '', null),
      ('AC3 an accepted registration change alone flags nothing', 'registration=Accepted', '', null),
      ('AC4 a declined field flags nothing', 'times=Rejected', '', null),
      ('AC4 declining times but accepting attendance flags only for attendance', 'times=Rejected;expected_attendance=Accepted', 'B1,B2', 'Expected attendance changed from 120 to 150'),
      ('AC1/AC2 times and attendance both accepted give each booking two reasons', 'times=Accepted;expected_attendance=Accepted', 'B1,B2', 'Event date/time changed | Expected attendance changed from 120 to 150')
    ) as t (label, decisions, expect_flagged, expect_detail)
  loop
    begin
      insert into public.event (name, preferred_date, status, expected_attendance, venue_requirements,
                                assigned_coordinator_user_account_id, owning_organiser_user_account_id, client_organisation_id)
      values ('Change Flag Test', date '2026-12-03', 'Planning', 120, 'None', v_coord, v_organiser, v_org)
      returning event_id into v_event;
      insert into public.event (name, preferred_date, status, expected_attendance,
                                assigned_coordinator_user_account_id, owning_organiser_user_account_id, client_organisation_id)
      values ('Change Flag Other', date '2026-12-04', 'Planning', 50, v_coord, v_organiser, v_org)
      returning event_id into v_other;

      v_b := '{}';
      -- B1 Confirmed, B2 unexpired hold, B3 Requested, B4 lapsed hold, B5 Rejected, B6 Confirmed and over
      for i in 1..6 loop
        insert into public.booking (venue_id, event_id, requested_by_user_account_id)
        values ((array[v_main, v_studio, v_rooftop, v_harbour, v_garden, v_main])[i], v_event, v_coord);
        v_b := v_b || (select max(booking_id) from public.booking);
        insert into public.booking_slot (booking_id, slot_date, slot)
        select v_b[i], case when i = 6 then date '2026-10-20' else date '2026-12-03' end, n::text from generate_series(52, 71) n;
      end loop;
      update public.booking set status = 'Confirmed', decided_by_user_account_id = v_coord where booking_id in (v_b[1], v_b[6]);
      update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_coord, hold_expires_at = now() + interval '1 day' where booking_id = v_b[2];
      update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_coord, hold_expires_at = now() - interval '1 hour' where booking_id = v_b[4];
      update public.booking set status = 'Rejected', decided_by_user_account_id = v_coord, rejection_note = 'No' where booking_id = v_b[5];
      -- the other event's booking
      insert into public.booking (venue_id, event_id, requested_by_user_account_id) values (v_main, v_other, v_coord);
      insert into public.booking_slot (booking_id, slot_date, slot)
        select (select max(booking_id) from public.booking), date '2026-12-04', n::text from generate_series(52, 71) n;
      update public.booking set status = 'Confirmed', decided_by_user_account_id = v_coord where booking_id = (select max(booking_id) from public.booking);

      -- the request, with one pending item per field named, then the decision
      insert into public.change_request (event_id, requesting_user_account_id) values (v_event, v_organiser)
      returning change_request_id into v_request;
      insert into public.change_request_item (change_request_id, field_name, requested_value)
      select v_request, split_part(d, '=', 1),
             case split_part(d, '=', 1)
               when 'times' then '[{"date":"2026-12-10","start":"09:00","end":"17:00"}]'
               when 'expected_attendance' then '150'
               when 'venue_requirements' then 'Stage and a lectern'
               when 'registration' then '{"enabled":true,"opensOn":"2026-11-01","closesOn":"2026-12-01"}'
               else null end
      from unnest(string_to_array(c.decisions, ';')) d;
      perform public.coordinator_decide_change_request(
        v_coord, v_request,
        (select jsonb_agg(jsonb_build_object('field_name', split_part(d, '=', 1), 'decision', split_part(d, '=', 2),
                'decision_reason', case when split_part(d, '=', 2) = 'Rejected' then 'No' end))
         from unnest(string_to_array(c.decisions, ';')) d));

      select coalesce(string_agg(x.k, ',' order by x.k), '') into v_flagged
      from (select distinct 'B' || (array_position(v_b, f.booking_id)) as k
            from public.booking_review_flag f where f.reason_code = 'event-change' and f.cleared_at is null) x;
      select coalesce(string_agg(distinct f.detail, ' | ' order by f.detail), null) into v_details
      from public.booking_review_flag f where f.reason_code = 'event-change';
      v_checks := v_checks + 1;
      if v_flagged <> c.expect_flagged then
        v_failed := array_append(v_failed, c.label || ': flagged "' || v_flagged || '", wanted "' || c.expect_flagged || '"');
      end if;
      if c.expect_detail is not null then
        v_checks := v_checks + 1;
        if v_details is distinct from (select string_agg(x, ' | ' order by x) from unnest(string_to_array(c.expect_detail, ' | ')) x) then
          v_failed := array_append(v_failed, c.label || ': reasons "' || coalesce(v_details, 'none') || '", wanted "' || c.expect_detail || '"');
        end if;
      end if;
      -- AC5: a flag never changes a status
      v_checks := v_checks + 1;
      select string_agg(status, ',' order by booking_id) into v_status from public.booking where booking_id = any (v_b);
      if v_status <> 'Confirmed,Tentative Hold,Requested,Tentative Hold,Rejected,Confirmed' then
        v_failed := array_append(v_failed, c.label || ': statuses are now ' || v_status);
      end if;
      -- another event's booking is never flagged
      v_checks := v_checks + 1;
      if exists (select 1 from public.booking_review_flag f join public.booking b using (booking_id) where b.event_id = v_other) then
        v_failed := array_append(v_failed, c.label || ': the other event''s booking was flagged');
      end if;

      raise exception 'rolled back' using errcode = 'CS999';
    exception when sqlstate 'CS999' then
      null;
    end;
  end loop;

  -- AC8-style: accepting the same field again restates the open reason; a cleared one stays
  -- cleared and the new change adds a fresh reason.
  begin
    insert into public.event (name, preferred_date, status, expected_attendance,
                              assigned_coordinator_user_account_id, owning_organiser_user_account_id, client_organisation_id)
    values ('Change Flag Repeat', date '2026-12-03', 'Planning', 120, v_coord, v_organiser, v_org)
    returning event_id into v_event;
    v_b := '{}';
    for i in 1..2 loop
      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values ((array[v_main, v_studio])[i], v_event, v_coord);
      v_b := v_b || (select max(booking_id) from public.booking);
      insert into public.booking_slot (booking_id, slot_date, slot)
      select v_b[i], date '2026-12-03', n::text from generate_series(52, 71) n;
      update public.booking set status = 'Confirmed', decided_by_user_account_id = v_coord where booking_id = v_b[i];
    end loop;

    for i in 1..3 loop
      insert into public.change_request (event_id, requesting_user_account_id) values (v_event, v_organiser)
      returning change_request_id into v_request;
      insert into public.change_request_item (change_request_id, field_name, requested_value)
      values (v_request, 'expected_attendance', (array['150', '180', '200'])[i]);
      perform public.coordinator_decide_change_request(
        v_coord, v_request, '[{"field_name":"expected_attendance","decision":"Accepted"}]'::jsonb);
      if i = 2 then
        -- the coordinator clears the first booking's reason before the third change
        update public.booking_review_flag
        set cleared_at = now(), cleared_by_user_account_id = v_coord, cleared_how = 'coordinator'
        where booking_id = v_b[1] and cleared_at is null;
        v_checks := v_checks + 1;
        select string_agg(detail, ' | ' order by booking_id) into v_details
        from public.booking_review_flag where booking_id = any (v_b) and cleared_at is null;
        if v_details <> 'Expected attendance changed from 150 to 180' then
          v_failed := array_append(v_failed, 'restate: after the second change the open reason reads "' || coalesce(v_details, 'none') || '"');
        end if;
      end if;
    end loop;

    v_checks := v_checks + 1;
    select string_agg(booking_id || ':' || (cleared_at is null)::text || ':' || detail, ' | ' order by booking_id, booking_review_flag_id)
      into v_details from public.booking_review_flag where booking_id = any (v_b);
    if v_details <> (v_b[1] || ':false:Expected attendance changed from 150 to 180 | ' || v_b[1] || ':true:Expected attendance changed from 180 to 200 | '
                     || v_b[2] || ':true:Expected attendance changed from 180 to 200') then
      v_failed := array_append(v_failed, 'repeat: the reasons are "' || coalesce(v_details, 'none') || '"');
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
