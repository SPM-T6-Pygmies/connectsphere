-- Seeds the Safety Officer's workflow (SPM-258 to SPM-263, SPM-319): eight Planning
-- events, each in the state a safety check case or the demo needs, with the
-- venue bookings and equipment lines that decide whether the event is on the
-- Awaiting check list.
--
--   Event                 Coordinator  On the list?  What it is for
--   Marina Bay Gala       1            Yes           220 expected in a Banquet layout that holds 180;
--                                                    microphones and barriers reserved in full
--   Canal Side Workshop   1            Yes           no date, attendance or equipment: the fallbacks
--   Winter Lantern Ball   2            Yes           another coordinator's event
--   Harbour Dawn Run      none         Yes           an outcome with nobody to tell
--   Lakeside Tech Expo    1            No            a booking still on a Tentative Hold
--   Charity Book Fair     1            No            one unreserved projector line, marked essential:
--                                                    the coordinator removing it, or marking it not
--                                                    essential (SPM-319), puts the event on the list
--   Spring Lantern Walk   1            No            two Requested bookings: Venue Staff approving
--                                                    both puts it on the list
--   Rooftop Jazz Night    1            No            one Confirmed booking, one Requested: Venue
--                                                    Staff rejecting the Requested one puts it on
--
-- Charity Book Fair is the demo's event: the coordinator removes the line, the
-- Safety Officers are told, one rejects with a reason, the coordinator is told,
-- reworks and resubmits, and the Officer approves.
--
-- The events are inserted directly -- there is no request behind them -- for
-- Test Organiser's organisation, and use the venues from seed-venues and the
-- equipment types of the Connectsphere Data Single Source of Truth. Seed the
-- accounts (supabase db reset) and run seed-venues first; this script stops
-- with an error if you did not.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-safety-check/seed.sql --local
--
-- Safe to run more than once: an event that already exists is left as it is,
-- so an outcome you have since recorded in the app is kept -- for a fresh
-- start, run teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_coordinator  bigint;
  v_coordinator2 bigint;
  v_venue_staff  bigint;
  v_organiser    bigint;
  v_organisation bigint;
  v_event        record;
  v_event_id     bigint;
  v_reservation  bigint;
begin
  -- 1. The accounts and the venues ----------------------------------------
  select user_account_id into v_coordinator
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id into v_coordinator2
    from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null;
  select user_account_id into v_venue_staff
    from public.user_account where name = 'Test Venue Staff' and client_organisation_id is null;
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_coordinator is null or v_coordinator2 is null or v_venue_staff is null or v_organiser is null
     or (select count(*) from public.venue
         where location in ('Main Hall', 'Seminar Room 2-1', 'Studio', 'Rooftop Terrace')) < 4 then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_coordinator is null then 'Test Coordinator' end,
        case when v_coordinator2 is null then 'Test Coordinator 2' end,
        case when v_venue_staff is null then 'Test Venue Staff' end,
        case when v_organiser is null then 'Test Organiser' end,
        case when (select count(*) from public.venue
                   where location in ('Main Hall', 'Seminar Room 2-1', 'Studio', 'Rooftop Terrace')) < 4
             then 'the venues (run seed-venues)' end)
      using hint = 'Seed the accounts (supabase db reset), then scripts/seed-venues/seed.sql.';
  end if;

  -- 2. The equipment types the lines use --------------------------------------
  insert into public.equipment_item (type, description, quantity, physical_location)
  select c.type, c.description, c.quantity, c.physical_location
  from (values
    ('Projector',           '5000-lumen laser projector with HDMI and USB-C inputs.',      10, 'Store room A'),
    ('Wireless microphone', 'Handheld UHF microphone with receiver.',                      30, 'Store room A'),
    ('Crowd barrier',       'Free-standing steel barrier panel for marshalling a crowd.',  40, 'Store room B')
  ) as c(type, description, quantity, physical_location)
  where not exists (select 1 from public.equipment_item i where i.type = c.type);

  -- 3. The events, their bookings and their lines -----------------------------
  for v_event in
    select *
    from (values
      ('Marina Bay Gala',     date '2026-11-20', 220, 'Step-free route to the stage; two wheelchair spaces', 1, true),
      ('Canal Side Workshop', null::date,        null, null,                                                1, false),
      ('Winter Lantern Ball', date '2026-12-05',  90, null,                                                 2, false),
      ('Harbour Dawn Run',    date '2026-12-12', 150, null,                                                 0, false),
      ('Lakeside Tech Expo',  date '2026-11-05', 300, null,                                                 1, false),
      ('Charity Book Fair',   date '2026-12-19', 300, null,                                                 1, true),
      ('Spring Lantern Walk', date '2026-12-05', 120, null,                                                 1, false),
      ('Rooftop Jazz Night',  null::date,        null, null,                                                1, false)
    ) as e(name, preferred_date, expected_attendance, accessibility_requirements, coordinator, has_lines)
  loop
    if exists (select 1 from public.event where name = v_event.name and client_organisation_id = v_organisation) then
      continue;
    end if;

    insert into public.event (
      name, preferred_date, expected_attendance, accessibility_requirements, status,
      assigned_coordinator_user_account_id, owning_organiser_user_account_id, client_organisation_id
    )
    values (
      v_event.name, v_event.preferred_date, v_event.expected_attendance,
      v_event.accessibility_requirements, 'Planning',
      case v_event.coordinator when 1 then v_coordinator when 2 then v_coordinator2 end,
      v_organiser, v_organisation
    )
    returning event_id into v_event_id;

    -- venue, layout, status. Every booking but a Requested one is decided by
    -- Venue Staff; a Tentative Hold expires three weeks out.
    insert into public.booking (
      venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id,
      status, room_layout_id, hold_expires_at
    )
    select vn.venue_id, v_event_id, v_coordinator,
           case when b.status <> 'Requested' then v_venue_staff end,
           b.status, rl.room_layout_id,
           case when b.status = 'Tentative Hold' then now() + interval '21 days' end
    from (values
      ('Marina Bay Gala',     'Main Hall',        'Banquet',    'Confirmed'),
      ('Canal Side Workshop', 'Seminar Room 2-1', 'Classroom',  'Confirmed'),
      ('Winter Lantern Ball', 'Studio',           'Theatre',    'Confirmed'),
      ('Harbour Dawn Run',    'Rooftop Terrace',  'Exhibition', 'Confirmed'),
      ('Lakeside Tech Expo',  'Main Hall',        'Theatre',    'Tentative Hold'),
      ('Charity Book Fair',   'Main Hall',        'Theatre',    'Confirmed'),
      ('Spring Lantern Walk', 'Main Hall',        'Banquet',    'Requested'),
      ('Spring Lantern Walk', 'Rooftop Terrace',  'Banquet',    'Requested'),
      ('Rooftop Jazz Night',  'Rooftop Terrace',  'Banquet',    'Confirmed'),
      ('Rooftop Jazz Night',  'Seminar Room 2-1', 'Classroom',  'Requested')
    ) as b(event, location, layout, status)
    join public.venue vn on vn.location = b.location
    join public.room_layout rl on rl.name = b.layout
    where b.event = v_event.name;

    if v_event.has_lines then
      insert into public.equipment_reservation (event_id)
      values (v_event_id)
      returning equipment_reservation_id into v_reservation;

      -- requested, reserved: a line is Reserved once the whole quantity is.
      -- essential: only an essential line keeps an event off the list (SPM-319),
      -- so the projector is marked, or the book fair would be listed already.
      insert into public.equipment_reservation_line (
        equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved, line_state,
        essential
      )
      select v_reservation, i.equipment_item_id, l.requested, l.reserved,
             case when l.reserved = 0 then 'Requested' else 'Reserved' end, l.essential
      from (values
        ('Marina Bay Gala',   'Wireless microphone',  4,  4, false),
        ('Marina Bay Gala',   'Crowd barrier',       10, 10, false),
        ('Charity Book Fair', 'Projector',            2,  0, true)
      ) as l(event, type, requested, reserved, essential)
      join public.equipment_item i on i.type = l.type
      where l.event = v_event.name;
    end if;
  end loop;
end;
$$;
