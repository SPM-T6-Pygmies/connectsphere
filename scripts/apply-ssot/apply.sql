-- Brings an EXISTING database to the Connectsphere Data Single Source of Truth
-- (SPM-277): the facilities, accessibility, capacity and layouts of the six
-- venues, and the owned counts of the six equipment types. The seeds only insert
-- what is missing, so re-running them leaves old rows as they were; this script
-- corrects the rows already there. Use it on local and remote databases.
--
-- Run against a local stack:
--   supabase db query --file scripts/apply-ssot/verify.sql --local   (before)
--   supabase db query --file scripts/apply-ssot/apply.sql --local
--   supabase db query --file scripts/apply-ssot/verify.sql --local   (after)
--
-- Safe to run more than once: it updates a row only when it differs, so a second
-- run changes nothing.
--
-- What it changes, and nothing else:
--   venue                    facilities, accessibility, capacity, for the six
--                            venues, matched by exact location
--   venue_supported_layout   inserts a missing SSOT layout; updates the seats of
--                            an SSOT layout. Never deletes: a layout a venue has
--                            beyond the SSOT is reported, not removed
--   room_layout              inserts Exhibition if it is missing
--   equipment_item           the owned count of the six types; inserts a missing
--                            type; deletes Laser projector, Handheld microphone,
--                            Stage monitor and Lectern only when no reservation
--                            line uses them
--
-- What it leaves alone: a venue that is not present (it never creates one), a
-- location or equipment type that appears more than once, a count that would
-- drop below the units out of service, and an extra equipment type that a
-- reservation line still uses. Each one is raised as a notice, but
-- `supabase db query` does not print notices (psql does). The report is
-- verify.sql: run it after, and every one of these shows as a row that is not ok.
--
-- One `do` block: `supabase db query --file` refuses a file holding more than one
-- statement. Its exit code is 0 even when the SQL fails, so run verify.sql after.

do $$
declare
  v           record;
  l           record;
  e           record;
  x           record;
  v_id        bigint;
  v_layout    bigint;
  v_found     integer;
  v_refs      integer;
  v_rows      integer;
  n_venues    integer := 0;
  n_layouts   integer := 0;
  n_equipment integer := 0;
  n_removed   integer := 0;
  n_skipped   integer := 0;
begin
  -- 1. Exhibition is a standard layout (created by a migration; restated here
  --    so the script stands on its own).
  insert into public.room_layout (name)
  select 'Exhibition'
  where not exists (select 1 from public.room_layout where name = 'Exhibition');

  -- 2. The six venues ---------------------------------------------------------
  for v in
    select *
    from (values
      ('Main Hall',           300, 'Wi-Fi, Catering area',      'Step-free access, Hearing loop'),
      ('Seminar Room 2-1',     40, 'Wi-Fi, Video-conferencing', 'Lift access'),
      ('Studio',               60, 'Wi-Fi, Video-conferencing', 'Step-free access'),
      ('Rooftop Terrace',     150, 'Catering area',             'Lift access'),
      ('UAT-44 Harbour Room', 250, 'Wi-Fi, Video-conferencing', 'Step-free access, Hearing loop'),
      ('UAT-44 Garden Hall',  500, 'Catering area',             'Lift access')
    ) as t (location, capacity, facilities, accessibility)
  loop
    select count(*) into v_found from public.venue where location = v.location;
    if v_found = 0 then
      raise notice 'venue % is not in this database: skipped', v.location;
      n_skipped := n_skipped + 1;
      continue;
    elsif v_found > 1 then
      raise notice 'venue % appears % times: left alone', v.location, v_found;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    update public.venue
       set facilities = v.facilities, accessibility = v.accessibility, capacity = v.capacity
     where location = v.location
       and (facilities is distinct from v.facilities
            or accessibility is distinct from v.accessibility
            or capacity is distinct from v.capacity);
    get diagnostics v_rows = row_count;
    n_venues := n_venues + v_rows;
  end loop;

  -- 3. Their layouts and seats ----------------------------------------------
  for l in
    select *
    from (values
      ('Main Hall',           'Theatre',    300),
      ('Main Hall',           'Banquet',    180),
      ('Main Hall',           'Classroom',  150),
      ('Seminar Room 2-1',    'Classroom',   40),
      ('Seminar Room 2-1',    'Boardroom',   24),
      ('Studio',              'Theatre',     60),
      ('Rooftop Terrace',     'Banquet',    120),
      ('Rooftop Terrace',     'Exhibition', 150),
      ('UAT-44 Harbour Room', 'Theatre',    200),
      ('UAT-44 Harbour Room', 'Boardroom',   20),
      ('UAT-44 Garden Hall',  'Banquet',    150),
      ('UAT-44 Garden Hall',  'Classroom',   80)
    ) as t (location, layout, seats)
  loop
    select count(*), min(venue_id) into v_found, v_id from public.venue where location = l.location;
    if v_found <> 1 then
      continue;  -- already reported in step 2
    end if;
    select room_layout_id into v_layout from public.room_layout where name = l.layout;

    insert into public.venue_supported_layout as s (venue_id, room_layout_id, capacity)
    values (v_id, v_layout, l.seats)
    on conflict (venue_id, room_layout_id)
      do update set capacity = excluded.capacity
      where s.capacity is distinct from excluded.capacity;
    get diagnostics v_rows = row_count;
    n_layouts := n_layouts + v_rows;
  end loop;

  -- A layout a venue has beyond the SSOT is never deleted (a booking may use it).
  for x in
    select ven.location, rl.name
    from public.venue ven
    join public.venue_supported_layout sl on sl.venue_id = ven.venue_id
    join public.room_layout rl on rl.room_layout_id = sl.room_layout_id
    where (ven.location, rl.name) not in (
      values ('Main Hall', 'Theatre'), ('Main Hall', 'Banquet'), ('Main Hall', 'Classroom'),
             ('Seminar Room 2-1', 'Classroom'), ('Seminar Room 2-1', 'Boardroom'),
             ('Studio', 'Theatre'),
             ('Rooftop Terrace', 'Banquet'), ('Rooftop Terrace', 'Exhibition'),
             ('UAT-44 Harbour Room', 'Theatre'), ('UAT-44 Harbour Room', 'Boardroom'),
             ('UAT-44 Garden Hall', 'Banquet'), ('UAT-44 Garden Hall', 'Classroom'))
      and ven.location in ('Main Hall', 'Seminar Room 2-1', 'Studio', 'Rooftop Terrace',
                         'UAT-44 Harbour Room', 'UAT-44 Garden Hall')
  loop
    raise notice 'venue % also supports %, which is not in the SSOT: kept', x.location, x.name;
  end loop;

  -- 4. The six equipment types and their owned counts -------------------------
  for e in
    select *
    from (values
      ('Projector',           10, '5000-lumen laser projector with HDMI and USB-C inputs.',     'Store room A'),
      ('Wireless microphone', 30, 'Handheld UHF microphone with receiver.',                      'Store room A'),
      ('PA speaker',           5, 'Powered 12-inch speaker on a stand.',                         'Store room B'),
      ('Presentation laptop',  8, 'Laptop with presentation software and clicker.',              'IT desk'),
      ('Livestream kit',       2, 'Camera, encoder and tripod for streaming a session.',         'Store room B'),
      ('Crowd barrier',       40, 'Free-standing steel barrier panel for marshalling a crowd.',  'Store room B')
    ) as t (type, quantity, description, physical_location)
  loop
    select count(*) into v_found from public.equipment_item where type = e.type;
    if v_found = 0 then
      insert into public.equipment_item (type, description, quantity, physical_location)
      values (e.type, e.description, e.quantity, e.physical_location);
      n_equipment := n_equipment + 1;
    elsif v_found > 1 then
      raise notice 'equipment % appears % times: left alone', e.type, v_found;
      n_skipped := n_skipped + 1;
    elsif exists (select 1 from public.equipment_item where type = e.type and out_of_service > e.quantity) then
      raise notice 'equipment %: % units are out of service, more than the SSOT count %: left alone',
        e.type, (select out_of_service from public.equipment_item where type = e.type), e.quantity;
      n_skipped := n_skipped + 1;
    else
      update public.equipment_item
         set quantity = e.quantity
       where type = e.type and quantity is distinct from e.quantity;
      get diagnostics v_rows = row_count;
      n_equipment := n_equipment + v_rows;
    end if;
  end loop;

  -- 5. Equipment types the SSOT does not list: remove only if unused ----------
  for x in
    select equipment_item_id, type
    from public.equipment_item
    where type in ('Laser projector', 'Handheld microphone', 'Stage monitor', 'Lectern')
    order by equipment_item_id
  loop
    select count(*) into v_refs
      from public.equipment_reservation_line where equipment_item_id = x.equipment_item_id;
    if v_refs = 0 then
      delete from public.equipment_item where equipment_item_id = x.equipment_item_id;
      n_removed := n_removed + 1;
    else
      raise notice 'equipment % is still used by % reservation line(s): kept for a person to decide',
        x.type, v_refs;
      n_skipped := n_skipped + 1;
    end if;
  end loop;

  raise notice 'apply-ssot: venues changed %, layouts changed %, equipment changed %, equipment removed %, left alone %',
    n_venues, n_layouts, n_equipment, n_removed, n_skipped;
end;
$$;
