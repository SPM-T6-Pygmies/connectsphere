-- Checks the database side of a venue's setup and turnaround time (SPM-23): the constraint, the
-- lock, the upcoming-booking rule, and the catalogue functions. Writes nothing that survives: it
-- ends in an error, which rolls everything back, and the error message is the result.
--
--   error: ok: all N checks held      every check passed. The CLI words this "failed to execute
--                                     query"; the ok: is the pass.
--   error: FAILED: <checks that did not hold>
--
-- Run against a local stack that has the base seed, seed-venues and seed-venue-search-uat (it
-- borrows Test Venue Staff, the venues, and the event UAT-44 Booked Harbour):
--   supabase db query --file scripts/seed-venue-buffers/checks.sql --local
--
-- Main Hall is defined 30 and 45, Studio 0 and 0, Seminar Room 2-1 and Rooftop Terrace are not.

do $$
declare
  v_main    bigint;
  v_studio  bigint;
  v_seminar bigint;
  v_rooftop bigint;
  v_staff_auth uuid;
  v_event   bigint;
  v_coord   bigint;
  v_booking bigint;
  v_day     date := (now() at time zone 'Asia/Singapore')::date + 10;
  v_code    text;
  v_json    jsonb;
  v_new     bigint;
  v_failed  text[] := '{}';
  v_checks  int := 0;

begin
  select venue_id into v_main    from public.venue where location = 'Main Hall';
  select venue_id into v_studio  from public.venue where location = 'Studio';
  select venue_id into v_seminar from public.venue where location = 'Seminar Room 2-1';
  select venue_id into v_rooftop from public.venue where location = 'Rooftop Terrace';
  select ua.auth_user_id into v_staff_auth
    from public.user_account ua where ua.name = 'Test Venue Staff' and ua.client_organisation_id is null;
  select e.event_id into v_event from public.event e where e.name = 'UAT-44 Booked Harbour';
  select user_account_id into v_coord
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  if v_main is null or v_studio is null or v_seminar is null or v_rooftop is null
     or v_staff_auth is null or v_event is null or v_coord is null then
    raise exception 'Run the base seed, seed-venues and seed-venue-search-uat first';
  end if;

  perform set_config('request.jwt.claim.sub', v_staff_auth::text, true);

  -- AC1, AC4: the seed's four states are what the catalogue reads back
  v_json := public.venue_catalogue(v_main) -> 0;
  v_checks := v_checks + 1;
  if (v_json ->> 'setup_minutes') <> '30' or (v_json ->> 'turnaround_minutes') <> '45' then
    v_failed := array_append(v_failed, 'AC1 the catalogue does not read Main Hall as 30 and 45'); end if;
  v_json := public.venue_catalogue(v_studio) -> 0;
  v_checks := v_checks + 1;
  if (v_json ->> 'setup_minutes') <> '0' or (v_json ->> 'turnaround_minutes') <> '0' then
    v_failed := array_append(v_failed, 'AC1 the catalogue does not read Studio as a defined 0 and 0'); end if;
  v_json := public.venue_catalogue(v_rooftop) -> 0;
  v_checks := v_checks + 1;
  if (v_json -> 'setup_minutes') <> 'null'::jsonb or (v_json -> 'turnaround_minutes') <> 'null'::jsonb then
    v_failed := array_append(v_failed, 'AC4 an undefined venue is not read as null'); end if;

  -- AC1, AC2: the constraint (a venue with none defined, so nothing but the constraint stands in the way)
  declare
    v_case record;
  begin
    for v_case in
      select * from (values
        ('one without the other', 30, null),
        ('the other without the first', null, 30),
        ('a setup off the grid', 20, 30),
        ('a turnaround off the grid', 30, 20),
        ('a negative setup', -15, 30),
        ('a setup over a day', 1455, 30),
        ('a turnaround over a day', 30, 1455)
      ) as t (label, setup, turnaround)
    loop
      begin
        update public.venue set setup_time_minutes = v_case.setup, turnaround_time_minutes = v_case.turnaround
         where venue_id = v_seminar;
        v_checks := v_checks + 1;
        v_failed := array_append(v_failed, 'AC2 ' || v_case.label || ' was accepted');
      exception when others then
        get stacked diagnostics v_code = returned_sqlstate;
        v_checks := v_checks + 1;
        if v_code <> '23514' then v_failed := array_append(v_failed, 'AC2 ' || v_case.label || ' gave ' || v_code); end if;
      end;
    end loop;
  end;

  -- AC2: a day is the most, and 0 is a value
  update public.venue set setup_time_minutes = 1440, turnaround_time_minutes = 1440 where venue_id = v_seminar;
  v_checks := v_checks + 1;
  if (select setup_time_minutes from public.venue where venue_id = v_seminar) <> 1440 then
    v_failed := array_append(v_failed, 'AC2 exactly a day was not stored'); end if;
  -- put it back for the next checks: this venue is locked now, so use a rolled-back subtransaction
  -- (the whole script rolls back, and the lock is checked below on this same row)

  -- AC3: the lock, directly on the table
  begin
    update public.venue set setup_time_minutes = 15 where venue_id = v_seminar;
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC3 a defined venue''s setup was changed');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC3 changing a defined value gave ' || v_code); end if;
  end;
  begin
    update public.venue set setup_time_minutes = null, turnaround_time_minutes = null where venue_id = v_main;
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC3 clearing a defined venue''s values was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC3 clearing gave ' || v_code); end if;
  end;
  begin
    update public.venue set setup_time_minutes = 15, turnaround_time_minutes = 0 where venue_id = v_studio;
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC3 a venue defined as 0 and 0 was changed');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC3 changing 0 and 0 gave ' || v_code); end if;
  end;
  -- sending a defined venue's own values back, and changing another column, are not changes
  update public.venue set setup_time_minutes = 30, turnaround_time_minutes = 45, capacity = capacity where venue_id = v_main;
  update public.venue set capacity = capacity where venue_id = v_main;
  v_checks := v_checks + 1;

  -- the catalogue's own update function: other details change, the values come back unchanged
  v_new := public.venue_catalogue_update(v_main, jsonb_build_object(
    'location', 'Main Hall', 'facilities', 'Wi-Fi, Catering area', 'accessibility', 'Step-free access, Hearing loop',
    'capacity', 300, 'booking_horizon_days', 90, 'setup_minutes', 30, 'turnaround_minutes', 45,
    'opening_hours', '[{"start":"07:00","end":"12:00"}]'::jsonb,
    'layouts', '[{"name":"Theatre","capacity":300}]'::jsonb));
  v_checks := v_checks + 1;
  if (select booking_horizon_days from public.venue where venue_id = v_main) <> 90 then
    v_failed := array_append(v_failed, 'AC3 a save that sends the locked values back did not go through'); end if;
  begin
    perform public.venue_catalogue_update(v_main, jsonb_build_object(
      'location', 'Main Hall', 'facilities', 'Wi-Fi', 'accessibility', 'Lift access', 'capacity', 300,
      'booking_horizon_days', 90, 'setup_minutes', 60, 'turnaround_minutes', 45,
      'opening_hours', '[{"start":"07:00","end":"12:00"}]'::jsonb, 'layouts', '[{"name":"Theatre","capacity":300}]'::jsonb));
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC3 the catalogue update changed a locked value');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS080' then v_failed := array_append(v_failed, 'AC3 the catalogue update gave ' || v_code); end if;
  end;

  -- AC1: create stores the pair, and refuses one half of it
  v_new := public.venue_catalogue_create(jsonb_build_object(
    'location', 'Buffer Test Hall', 'facilities', 'Wi-Fi', 'accessibility', 'Lift access', 'capacity', 50,
    'booking_horizon_days', 30, 'setup_minutes', 15, 'turnaround_minutes', 30,
    'opening_hours', '[{"start":"07:00","end":"12:00"}]'::jsonb, 'layouts', '[{"name":"Theatre","capacity":50}]'::jsonb));
  v_checks := v_checks + 1;
  if (select setup_time_minutes || '/' || turnaround_time_minutes from public.venue where venue_id = v_new) <> '15/30' then
    v_failed := array_append(v_failed, 'AC1 create did not store the pair'); end if;
  begin
    perform public.venue_catalogue_create(jsonb_build_object(
      'location', 'Half Hall', 'facilities', 'Wi-Fi', 'accessibility', 'Lift access', 'capacity', 50,
      'booking_horizon_days', 30, 'setup_minutes', 15,
      'opening_hours', '[{"start":"07:00","end":"12:00"}]'::jsonb, 'layouts', '[{"name":"Theatre","capacity":50}]'::jsonb));
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC1 create accepted one without the other');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS022' then v_failed := array_append(v_failed, 'AC1 create with one value gave ' || v_code); end if;
  end;

  -- AC5: not while a booking has not ended (Rooftop Terrace has none defined)
  insert into public.booking (venue_id, event_id, requested_by_user_account_id)
  values (v_rooftop, v_event, v_coord) returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) select v_booking, v_day, n::text from generate_series(40, 47) n;
  v_checks := v_checks + 1;
  if not public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a Requested booking next week is not upcoming'); end if;
  begin
    update public.venue set setup_time_minutes = 30, turnaround_time_minutes = 45 where venue_id = v_rooftop;
    v_checks := v_checks + 1; v_failed := array_append(v_failed, 'AC5 defining with an upcoming booking was accepted');
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_checks := v_checks + 1;
    if v_code <> 'CS081' then v_failed := array_append(v_failed, 'AC5 defining with an upcoming booking gave ' || v_code); end if;
  end;
  -- undefined stays undefined and other columns may change while it is booked
  update public.venue set capacity = capacity where venue_id = v_rooftop;
  v_checks := v_checks + 1;

  -- AC5: a Rejected booking, and a booking that has ended, do not count
  update public.booking set status = 'Rejected', decided_by_user_account_id = v_coord, rejection_note = 'Not needed' where booking_id = v_booking;
  v_checks := v_checks + 1;
  if public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a Rejected booking counts as upcoming'); end if;
  update public.booking set status = 'Confirmed', decided_by_user_account_id = v_coord, rejection_note = null where booking_id = v_booking;
  update public.booking_slot set slot_date = (now() at time zone 'Asia/Singapore')::date - 30 where booking_id = v_booking;
  v_checks := v_checks + 1;
  if public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a Confirmed booking from a month ago counts as upcoming'); end if;

  -- AC5: a booking that ended earlier today is not upcoming, one still running is
  delete from public.booking_slot where booking_id = v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, (now() at time zone 'Asia/Singapore')::date, '0');
  v_checks := v_checks + 1;
  if (now() at time zone 'Asia/Singapore')::time > time '00:15' and public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a booking that ended at 00:15 today counts as upcoming'); end if;

  -- AC5: the last slot of today ends at 24:00, tonight, so a booking on it is upcoming all day
  delete from public.booking_slot where booking_id = v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, (now() at time zone 'Asia/Singapore')::date, '95');
  v_checks := v_checks + 1;
  if not public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a booking on today''s last slot, ending at midnight, is not upcoming'); end if;

  -- AC5: a Tentative Hold counts while it holds, and not once it has lapsed
  update public.booking set status = 'Tentative Hold', hold_expires_at = now() + interval '1 day' where booking_id = v_booking;
  v_checks := v_checks + 1;
  if not public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a live Tentative Hold is not upcoming'); end if;
  update public.booking set hold_expires_at = now() - interval '1 hour' where booking_id = v_booking;
  v_checks := v_checks + 1;
  if public.venue_has_upcoming_booking(v_rooftop) then
    v_failed := array_append(v_failed, 'AC5 a lapsed Tentative Hold counts as upcoming'); end if;
  update public.booking set status = 'Confirmed', hold_expires_at = null where booking_id = v_booking;
  delete from public.booking_slot where booking_id = v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_booking, (now() at time zone 'Asia/Singapore')::date - 1, '0');

  -- AC5: defining is then allowed
  update public.venue set setup_time_minutes = 30, turnaround_time_minutes = 45 where venue_id = v_rooftop;
  v_checks := v_checks + 1;
  if (select setup_time_minutes from public.venue where venue_id = v_rooftop) <> 30 then
    v_failed := array_append(v_failed, 'AC5 defining after the booking ended did not store'); end if;

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
