-- Seeds the lines Technical Support reserve or mark unfulfilled in the
-- SPM-274 manual tests (docs/testing/EQUIPMENT_RESERVE_MANUAL_TESTS.md). Every
-- line starts New, with nothing reserved.
--
--   Event               Date        Status     Lines (all New)
--   Design Sprint Demo  2026-11-20  Planning   Presentation laptop 6, PA speaker 3
--   Sales Kickoff       2026-11-21  Planning   Presentation laptop 3, Wireless microphone 2
--   Board Offsite       2026-11-20  Confirmed  PA speaker 3
--   Press Briefing      no date     Planning   Projector 1
--
-- Design Sprint Demo and Sales Kickoff are a day apart, so they draw on the
-- same 8 Presentation laptops: once 6 are reserved for one, 2 are left for the
-- other (AC5), too few for its 3 (AC3). Design Sprint Demo and Board Offsite
-- each need 3 of the 5 PA speakers on the same day: whoever reserves second is
-- refused (AC6). No other seed's event is within a day of 20 or 21 Nov, so its
-- reservations do not change these counts.
--
-- The events are inserted directly -- there is no request behind them -- for
-- Test Organiser's organisation, assigned to Test Coordinator. Seed the
-- accounts first (supabase db reset); this script stops with an error if you
-- did not.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment-reserve/seed.sql --local
--
-- Safe to run more than once: an event that already exists is left as it is,
-- so lines you have since reserved in the app are kept -- for a fresh start,
-- run teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_coordinator  bigint;
  v_organiser    bigint;
  v_organisation bigint;
  v_event        record;
  v_event_id     bigint;
  v_reservation  bigint;
begin
  -- 1. The accounts --------------------------------------------------------
  select user_account_id into v_coordinator
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_coordinator is null or v_organiser is null then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_coordinator is null then 'Test Coordinator' end,
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
    ('Presentation laptop', 'Laptop with presentation software and clicker.',          8,  'IT desk')
  ) as c(type, description, quantity, physical_location)
  where not exists (select 1 from public.equipment_item i where i.type = c.type);

  -- 3. The events and their lines --------------------------------------------
  for v_event in
    select *
    from (values
      ('Design Sprint Demo', date '2026-11-20', 'Planning'),
      ('Sales Kickoff',      date '2026-11-21', 'Planning'),
      ('Board Offsite',      date '2026-11-20', 'Confirmed'),
      ('Press Briefing',     null::date,        'Planning')
    ) as e(name, preferred_date, status)
  loop
    if exists (select 1 from public.event where name = v_event.name and client_organisation_id = v_organisation) then
      continue;
    end if;

    insert into public.event (
      name, preferred_date, status, assigned_coordinator_user_account_id,
      owning_organiser_user_account_id, client_organisation_id
    )
    values (v_event.name, v_event.preferred_date, v_event.status, v_coordinator, v_organiser, v_organisation)
    returning event_id into v_event_id;

    insert into public.equipment_reservation (event_id)
    values (v_event_id)
    returning equipment_reservation_id into v_reservation;

    insert into public.equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested)
    select v_reservation, i.equipment_item_id, l.requested
    from (values
      ('Design Sprint Demo', 'Presentation laptop', 6),
      ('Design Sprint Demo', 'PA speaker',          3),
      ('Sales Kickoff',      'Presentation laptop', 3),
      ('Sales Kickoff',      'Wireless microphone', 2),
      ('Board Offsite',      'PA speaker',          3),
      ('Press Briefing',     'Projector',           1)
    ) as l(event, type, requested)
    join public.equipment_item i on i.type = l.type
    where l.event = v_event.name;
  end loop;
end;
$$;
