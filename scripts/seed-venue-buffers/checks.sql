-- Checks the database side of a venue's setup and turnaround time (SPM-23): the constraint, the
-- lock, and the catalogue functions. Writes nothing that survives: it
-- ends in an error, which rolls everything back, and the error message is the result.
--
--   error: ok: all N checks held      every check passed. The CLI words this "failed to execute
--                                     query"; the ok: is the pass.
--   error: FAILED: <checks that did not hold>
--
-- Run against a local stack that has the base seed and seed-venues (it borrows Test Venue Staff
-- and the venues):
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
  if v_main is null or v_studio is null or v_seminar is null or v_rooftop is null
     or v_staff_auth is null then
    raise exception 'Run the base seed and seed-venues first';
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
        ('a setup over 150 minutes', 165, 30),
        ('a turnaround over 150 minutes', 30, 165)
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

  -- AC2: 150 minutes is the most, and 0 is a value
  update public.venue set setup_time_minutes = 150, turnaround_time_minutes = 150 where venue_id = v_seminar;
  v_checks := v_checks + 1;
  if (select setup_time_minutes from public.venue where venue_id = v_seminar) <> 150 then
    v_failed := array_append(v_failed, 'AC2 exactly 150 minutes was not stored'); end if;
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

  if cardinality(v_failed) = 0 then
    raise exception 'ok: all % checks held', v_checks;
  else
    raise exception 'FAILED: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
