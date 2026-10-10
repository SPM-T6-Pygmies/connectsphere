-- Seeds Technical Support's three equipment lists (SPM-273): events whose
-- lines are new, changed or have their removal requested (Needs review),
-- active events whose lines are all reserved (Reviewed), and Completed or
-- Cancelled events (Archive) -- plus the neighbours that make AC4's
-- availability count something.
--
-- AC4, worked: Projector, 10 owned. Tech Summit Keynote runs on
-- 15 Nov and needs 4, so its units are out on 14 and 15 Nov. Other events hold
-- 3 (14 Nov), 2 (15 Nov) and 1 (16 Nov): 5 are out on 14 Nov (the 14 and
-- 15 Nov events) and 3 on 15 Nov (the 15 and 16 Nov events), so 5 are
-- available. The 5 held on 17 Nov, and the 4 a Cancelled event holds on
-- 15 Nov, do not count.
--
--   Event                     Date        Status     Coordinator  List
--   Tech Summit Keynote       2026-11-15  Planning   1            Needs review (New, Changed, Removal requested)
--   Alumni Networking Night   2026-12-03  Blocked    2            Needs review (New)
--   Partner Roadshow          no date     Confirmed  1            Needs review (New, no date for AC4)
--   Product Launch Rehearsal  2026-11-14  Planning   2            Reviewed
--   Board Strategy Day        2026-11-15  Confirmed  1            Reviewed
--   Charity Gala Setup        2026-11-16  Blocked    2            Reviewed
--   Year-End Town Hall        2026-11-17  Planning   1            Reviewed
--   Autumn Workshop           2026-11-15  Cancelled  1            Archive (still has a New line)
--   Spring Conference         2026-09-20  Completed  2            Archive
--
-- The events are inserted directly -- there is no request behind them -- for
-- Test Organiser's organisation. Seed the accounts first (supabase db reset);
-- this script stops with an error if you did not.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment-review/seed.sql --local
--
-- Safe to run more than once: an event that already exists is left as it is,
-- so lines you have since changed in the app are kept -- for a fresh start,
-- run teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_support      bigint;
  v_coordinator  bigint;
  v_coordinator2 bigint;
  v_organiser    bigint;
  v_organisation bigint;
  v_event        record;
  v_event_id     bigint;
  v_reservation  bigint;
begin
  -- 1. The accounts --------------------------------------------------------
  select user_account_id into v_support
    from public.user_account where name = 'Test Support Staff' and client_organisation_id is null;
  select user_account_id into v_coordinator
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id into v_coordinator2
    from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null;
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_support is null or v_coordinator is null or v_coordinator2 is null or v_organiser is null then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_support is null then 'Test Support Staff' end,
        case when v_coordinator is null then 'Test Coordinator' end,
        case when v_coordinator2 is null then 'Test Coordinator 2' end,
        case when v_organiser is null then 'Test Organiser' end)
      using hint = 'Seed the accounts first: supabase db reset.';
  end if;

  -- 2. The catalogue: four of the six equipment types of the Connectsphere Data
  --    Single Source of Truth (SPM-277), with the same description, count and
  --    location as seed-equipment, so loading either seed first gives the same
  --    catalogue. No type is added here that the SSOT does not list.
  insert into public.equipment_item (type, description, quantity, physical_location)
  select c.type, c.description, c.quantity, c.physical_location
  from (values
    ('Projector',           '5000-lumen laser projector with HDMI and USB-C inputs.', 10, 'Store room A'),
    ('Wireless microphone', 'Handheld UHF microphone with receiver.',                  30, 'Store room A'),
    ('PA speaker',          'Powered 12-inch speaker on a stand.',                     5,  'Store room B'),
    ('Livestream kit',      'Camera, encoder and tripod for streaming a session.',     2,  'Store room B')
  ) as c(type, description, quantity, physical_location)
  where not exists (select 1 from public.equipment_item i where i.type = c.type);

  -- 3. The events and their lines --------------------------------------------
  for v_event in
    select *
    from (values
      ('Tech Summit Keynote',      date '2026-11-15', 'Planning',  1),
      ('Alumni Networking Night',  date '2026-12-03', 'Blocked',   2),
      ('Partner Roadshow',         null::date,        'Confirmed', 1),
      ('Product Launch Rehearsal', date '2026-11-14', 'Planning',  2),
      ('Board Strategy Day',       date '2026-11-15', 'Confirmed', 1),
      ('Charity Gala Setup',       date '2026-11-16', 'Blocked',   2),
      ('Year-End Town Hall',       date '2026-11-17', 'Planning',  1),
      ('Autumn Workshop',          date '2026-11-15', 'Cancelled', 1),
      ('Spring Conference',        date '2026-09-20', 'Completed', 2)
    ) as e(name, preferred_date, status, coordinator)
  loop
    if exists (select 1 from public.event where name = v_event.name and client_organisation_id = v_organisation) then
      continue;
    end if;

    insert into public.event (
      name, preferred_date, status, assigned_coordinator_user_account_id,
      owning_organiser_user_account_id, client_organisation_id
    )
    values (
      v_event.name, v_event.preferred_date, v_event.status,
      case v_event.coordinator when 1 then v_coordinator else v_coordinator2 end,
      v_organiser, v_organisation
    )
    returning event_id into v_event_id;

    insert into public.equipment_reservation (event_id, reviewed_by_user_account_id)
    values (v_event_id, v_support)
    returning equipment_reservation_id into v_reservation;

    -- requested, reserved, notes, and for a line under review what it was
    -- reserved as and whether its removal was requested.
    insert into public.equipment_reservation_line (
      equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved,
      technical_requirements, line_state, reviewed_quantity_requested,
      reviewed_technical_requirements, removal_requested_at
    )
    select v_reservation, i.equipment_item_id, l.requested, l.reserved, l.notes,
           case when l.reserved = 0 then 'Requested'
                when l.reviewed_requested is not null then 'Under review'
                else 'Reserved' end,
           l.reviewed_requested, l.reviewed_notes,
           case when l.removal then now() end
    from (values
      ('Tech Summit Keynote',      'Projector',           4, 0, 'HDMI and USB-C',        null::int, null,               false),
      ('Tech Summit Keynote',      'Wireless microphone', 6, 4, 'Two on the stage',      4,         'One on the stage', false),
      ('Tech Summit Keynote',      'PA speaker',          2, 2, null,                    2,         null,               true),
      ('Alumni Networking Night',  'Livestream kit',      1, 0, null,                    null,      null,               false),
      ('Partner Roadshow',         'Projector',           2, 0, null,                    null,      null,               false),
      ('Product Launch Rehearsal', 'Projector',           3, 3, null,                    null,      null,               false),
      ('Board Strategy Day',       'Projector',           2, 2, null,                    null,      null,               false),
      ('Board Strategy Day',       'Wireless microphone', 2, 2, null,                    null,      null,               false),
      ('Charity Gala Setup',       'Projector',           1, 1, null,                    null,      null,               false),
      ('Year-End Town Hall',       'Projector',           5, 5, null,                    null,      null,               false),
      ('Autumn Workshop',          'Projector',           4, 4, null,                    null,      null,               false),
      ('Autumn Workshop',          'Livestream kit',      1, 0, null,                    null,      null,               false),
      ('Spring Conference',        'Wireless microphone', 2, 2, null,                    null,      null,               false)
    ) as l(event, type, requested, reserved, notes, reviewed_requested, reviewed_notes, removal)
    join public.equipment_item i on i.type = l.type
    where l.event = v_event.name;
  end loop;
end;
$$;
