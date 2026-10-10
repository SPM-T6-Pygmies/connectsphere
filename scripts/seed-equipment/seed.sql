-- Seeds equipment for the coordinator's event page (SPM-41): a small
-- equipment catalogue, and one event whose requirements Technical Support
-- have already reserved against -- so both sides of SPM-41 AC7/AC8 (editing
-- an unreserved line vs a reserved one) can be tried in the app.
--
-- The event is Founders' Gala Dinner: seed-coordinator-view seeds its request
-- as Approved and assigned to Test Coordinator, but seeds no event for it --
-- approving in the app is what normally opens one. This opens it the same way
-- coordinator_decide_event_request does, in Planning. Run
-- seed-coordinator-view first; this script stops with an error if you did not.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment/seed.sql --local
--
-- Safe to run more than once: every insert is guarded by an existence check,
-- so it never resets a line you have since edited in the app -- for that, run
-- teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_coordinator bigint;
  v_support     bigint;
  v_request     public.event_request;
  v_event       bigint;
  v_reservation bigint;
begin
  -- 1. The accounts and the approved request ------------------------------
  select user_account_id into v_coordinator
    from public.user_account where name = 'Test Coordinator' and client_organisation_id is null;
  select user_account_id into v_support
    from public.user_account where name = 'Test Support Staff' and client_organisation_id is null;
  select * into v_request
    from public.event_request
    where event_name = 'Founders'' Gala Dinner' and status = 'Approved'
      and assigned_coordinator_user_account_id = v_coordinator;

  if v_coordinator is null or v_support is null or v_request.event_request_id is null then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_coordinator is null then 'Test Coordinator' end,
        case when v_support is null then 'Test Support Staff' end,
        case when v_request.event_request_id is null
          then 'the Approved Founders'' Gala Dinner request' end)
      using hint = 'Seed the accounts (supabase db reset), then scripts/seed-coordinator-view/seed.sql.';
  end if;

  -- 2. The catalogue: the six types and owned counts of the Connectsphere Data
--    Single Source of Truth (SPM-277) ----------------------------------------
  insert into public.equipment_item (type, description, quantity, physical_location)
  select c.type, c.description, c.quantity, c.physical_location
  from (values
    ('Projector',           '5000-lumen laser projector with HDMI and USB-C inputs.', 10, 'Store room A'),
    ('Wireless microphone', 'Handheld UHF microphone with receiver.',                  30, 'Store room A'),
    ('PA speaker',          'Powered 12-inch speaker on a stand.',                     5,  'Store room B'),
    ('Presentation laptop', 'Laptop with presentation software and clicker.',          8,  'IT desk'),
    ('Livestream kit',      'Camera, encoder and tripod for streaming a session.',     2,  'Store room B'),
    ('Crowd barrier',       'Free-standing steel barrier panel for marshalling a crowd.', 40, 'Store room B')
  ) as c(type, description, quantity, physical_location)
  where not exists (select 1 from public.equipment_item i where i.type = c.type);

  -- 3. The event, opened from the approved request -------------------------
  select event_id into v_event from public.event where event_request_id = v_request.event_request_id;
  if v_event is null then
    insert into public.event (
      event_request_id, name, description, purpose, preferred_date,
      expected_attendance, venue_requirements, room_layout_preference,
      accessibility_requirements, equipment_requirements, programme_agenda,
      special_arrangements, status, assigned_coordinator_user_account_id,
      owning_organiser_user_account_id, client_organisation_id
    )
    values (
      v_request.event_request_id, v_request.event_name, v_request.description,
      v_request.purpose, v_request.preferred_date, v_request.expected_attendance,
      v_request.venue_requirements, v_request.room_layout_preferences,
      v_request.accessibility_needs, v_request.equipment_requirements,
      v_request.general_programme, v_request.other_special_arrangements, 'Planning',
      v_request.assigned_coordinator_user_account_id,
      v_request.requesting_user_account_id, v_request.client_organisation_id
    )
    returning event_id into v_event;
  end if;

  -- 4. Its requirements: one line reserved, one not yet ---------------------
  select equipment_reservation_id into v_reservation
    from public.equipment_reservation where event_id = v_event;
  if v_reservation is null then
    insert into public.equipment_reservation (event_id, reviewed_by_user_account_id, status)
    values (v_event, v_support, 'Partially Reserved')
    returning equipment_reservation_id into v_reservation;
  end if;

  insert into public.equipment_reservation_line (
    equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved,
    line_state, fulfilment_status, technical_requirements
  )
  select v_reservation, i.equipment_item_id, l.requested, l.reserved,
         case when l.reserved > 0 then 'Reserved' else 'Requested' end, l.fulfilment, l.notes
  from (values
    ('Projector',           2, 2, 'Fulfilled', 'HDMI input; mounted above the stage.'),
    ('Wireless microphone', 4, 0, 'Pending',   null)
  ) as l(type, requested, reserved, fulfilment, notes)
  join public.equipment_item i on i.type = l.type
  where not exists (
    select 1 from public.equipment_reservation_line x
    where x.equipment_reservation_id = v_reservation and x.equipment_item_id = i.equipment_item_id
  );
end;
$$;
