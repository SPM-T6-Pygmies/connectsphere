-- The default data for `pnpm e2e:data`: the standard catalogue, and one or two event requests
-- and events in each state the app reaches. Every row is complete, so no screen shows a blank
-- because a seed skipped a column.
--
--   Request                    Status        Organiser  Coordinator
--   Spring Leadership Offsite  Draft         1          -
--   Quarterly Partner Briefing Submitted     2          -            for the Lead to assign
--   Customer Advisory Day      Under Review  1          1
--   Graduate Intake Welcome    Under Review  2          2
--   Supplier Awards Lunch      Returned      1          1            open clarification question
--   Rooftop Product Launch     Rejected      2          1            with a reason
--   Team Volunteering Day      Withdrawn     1          2            with a reason
--
--   Event (each from an Approved request)
--   Winter Networking Mixer    Planning   booking Requested, equipment awaiting Technical Support
--   Year-End Town Hall         Planning   hold flagged by a block, and one Rejected booking
--   Client Appreciation Dinner Planning   all arranged, on the Safety Officer's Awaiting check list
--   Product Roadmap Workshop   Planning   safety check Approved, ready to confirm
--   Annual Customer Conference Confirmed  registration open, 3 registrants, open change request
--   Autumn Partner Summit      Completed  in October 2026, with operational notes
--   Holiday Charity Gala       Cancelled  booking Released
--
-- `Blocked` is not seeded: nothing in the app ever sets it.
--
-- State changes go through the app's own database functions, not direct writes, so the data is
-- what real use produces and this file fails loudly when a rule changes. Direct writes remain
-- only where no function exists: the catalogue, essential arrangements and event capacity.
--
-- Dates are fixed (December 2026, inside the 180-day horizon), so the data is the
-- same whichever day it is loaded. The exception is the hold, which must expire in the future.
--
-- Run with `pnpm e2e:data reset`, or against a database that has the test accounts:
--   supabase db query --file scripts/seed-e2e/seed.sql --local
--
-- Not re-runnable on top of itself: it stops if it finds its own data. Run teardown.sql first.
-- One `do` block: the CLI refuses a file holding more than one statement.

do $$
declare
  v_organisation bigint := (select client_organisation_id from public.client_organisation
                            where name = 'Test Organisation');
  v_organiser_1  bigint := (select user_account_id from public.user_account where name = 'Test Organiser');
  v_organiser_2  bigint := (select user_account_id from public.user_account where name = 'Test Organiser 2');
  v_coord_1      bigint := (select user_account_id from public.user_account where name = 'Test Coordinator');
  v_coord_2      bigint := (select user_account_id from public.user_account where name = 'Test Coordinator 2');
  v_staff        bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_support      bigint := (select user_account_id from public.user_account where name = 'Test Support Staff');
  v_safety       bigint := (select user_account_id from public.user_account where name = 'Test Safety Officer');
  v              record;
  r              record;
  b              record;
  l              record;
  v_id           bigint;
  v_coordinator  bigint;
  v_request      bigint;
  v_event        bigint;
  v_booking      bigint;
begin
  if v_organisation is null or v_organiser_1 is null or v_organiser_2 is null or v_coord_1 is null
     or v_coord_2 is null or v_staff is null or v_support is null or v_safety is null then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;

  if exists (select 1 from public.event_request where event_name = 'Annual Customer Conference') then
    raise exception 'The e2e data is already loaded' using hint = 'Run scripts/seed-e2e/teardown.sql first.';
  end if;

  -- 1. Venues: the Connectsphere Data Single Source of Truth (SPM-277), each with a horizon,
  --    opening hours, layouts and buffers. Only blanks are filled, because buffers lock once
  --    defined; verify.sql reports a venue that already held other values.
  insert into public.room_layout (name)
  values ('Theatre'), ('Classroom'), ('Banquet'), ('Boardroom'), ('Exhibition')
  on conflict (name) do nothing;

  for v in
    select * from (values
      ('Main Hall',           300, 'Wi-Fi, Catering area',      'Step-free access, Hearing loop', 30, 45, 95),
      ('Seminar Room 2-1',     40, 'Wi-Fi, Video-conferencing', 'Lift access',                    15, 15, 95),
      ('Studio',               60, 'Wi-Fi, Video-conferencing', 'Step-free access',                0,  0, 95),
      ('Rooftop Terrace',     150, 'Catering area',             'Lift access',                    30, 30, 95),
      ('UAT-44 Harbour Room', 250, 'Wi-Fi, Video-conferencing', 'Step-free access, Hearing loop', 15, 30, 95),
      ('UAT-44 Garden Hall',  500, 'Catering area',             'Lift access',                    30, 60, 71)
    ) as t (location, capacity, facilities, accessibility, setup_minutes, turnaround_minutes, last_slot)
  loop
    select venue_id into v_id from public.venue where location = v.location;
    if v_id is null then
      insert into public.venue (location, capacity, facilities, accessibility)
      values (v.location, v.capacity, v.facilities, v.accessibility)
      returning venue_id into v_id;
    end if;

    update public.venue
    set booking_horizon_days = coalesce(booking_horizon_days, 180)
    where venue_id = v_id;

    update public.venue
    set setup_time_minutes = v.setup_minutes, turnaround_time_minutes = v.turnaround_minutes
    where venue_id = v_id and setup_time_minutes is null;

    -- Open from 07:00: to 24:00, or to 18:00 at the Garden Hall.
    insert into public.venue_slot (venue_id, slot_code)
    select v_id, n::text
    from generate_series(28, v.last_slot) n
    where not exists (select 1 from public.venue_slot where venue_id = v_id);
  end loop;

  insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
  select vn.venue_id, rl.room_layout_id, t.capacity
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
  ) as t (location, layout, capacity)
  join public.venue vn on vn.location = t.location
  join public.room_layout rl on rl.name = t.layout
  on conflict (venue_id, room_layout_id) do nothing;

  -- 2. Equipment: the six types and owned counts of the Single Source of Truth, with two crowd
  --    barriers out of service so that state shows.
  insert into public.equipment_item (type, description, quantity, physical_location)
  select c.type, c.description, c.quantity, c.physical_location
  from (values
    ('Projector',           '5000-lumen laser projector with HDMI and USB-C inputs.',     10, 'Store room A'),
    ('Wireless microphone', 'Handheld UHF microphone with receiver.',                     30, 'Store room A'),
    ('PA speaker',          'Powered 12-inch speaker on a stand.',                         5, 'Store room B'),
    ('Presentation laptop', 'Laptop with presentation software and clicker.',              8, 'IT desk'),
    ('Livestream kit',      'Camera, encoder and tripod for streaming a session.',         2, 'Store room B'),
    ('Crowd barrier',       'Free-standing steel barrier panel for marshalling a crowd.', 40, 'Store room B')
  ) as c (type, description, quantity, physical_location)
  where not exists (select 1 from public.equipment_item i where i.type = c.type);

  update public.equipment_item set out_of_service = 2
  where type = 'Crowd barrier' and out_of_service = 0;

  -- 3. Event requests, each filled in the way the Organiser's form fills it, then moved to its
  --    state the way the coordinator's screens move it.
  for r in
    select * from (values
      ('Spring Leadership Offsite',  1, 0, 'Draft',     date '2026-12-02', time '09:00', time '16:00',  30, 'Boardroom',
       'Two sessions on next year''s leadership priorities.', 'Agree the priorities for the coming year.',
       'A quiet room with natural light.', 'Lift access for one attendee.', 'One projector.', 'Invitation only.',
       'Morning: priorities. Afternoon: action plans.', 'Vegetarian lunch.', null),
      ('Quarterly Partner Briefing', 2, 0, 'Submitted', date '2026-12-03', time '14:00', time '16:00',  80, 'Theatre',
       'An update for partners on the quarter''s results.', 'Keep partners informed ahead of renewals.',
       'A room that seats 80 with a stage.', 'Step-free access.', 'Projector and two microphones.', 'Partners register in advance.',
       'Results, roadmap, then questions.', 'Coffee on arrival.', null),
      ('Customer Advisory Day',      1, 1, 'Under Review', date '2026-12-07', time '10:00', time '15:00',  45, 'Classroom',
       'Working sessions with the customer advisory board.', 'Gather feedback on the product roadmap.',
       'A room with tables for group work.', 'Hearing loop preferred.', 'Projector and a presentation laptop.', 'Invited customers only.',
       'Opening talk, three group sessions, summary.', 'Lunch for 45.', null),
      ('Graduate Intake Welcome',    2, 2, 'Under Review', date '2026-12-14', time '09:00', time '12:00', 100, 'Theatre',
       'A welcome morning for the new graduate intake.', 'Introduce graduates to the company and each other.',
       'A room that seats 100.', 'Step-free access.', 'Projector and two microphones.', 'Graduates are registered by HR.',
       'Welcome, leadership talk, team introductions.', 'Name badges at the door.', null),
      ('Supplier Awards Lunch',      1, 1, 'Returned',  date '2026-12-16', time '12:00', time '14:30',  90, 'Banquet',
       'A lunch recognising this year''s best suppliers.', 'Strengthen supplier relationships before renewals.',
       'A room that takes round tables.', 'Lift access.', 'Two microphones.', 'Invited suppliers only.',
       'Lunch, then awards.', 'Halal and vegetarian options.', null),
      ('Rooftop Product Launch',     2, 1, 'Rejected',  date '2026-12-17', time '18:00', time '21:00', 400, 'Exhibition',
       'An evening launch of the new product line.', 'Announce the product line to customers and press.',
       'An outdoor space with a view.', 'Lift access.', 'PA speakers and a livestream kit.', 'Open registration, no walk-ins.',
       'Demo stations, a short keynote, networking.', 'Canapes and drinks.', null),
      ('Team Volunteering Day',      1, 2, 'Withdrawn', date '2026-12-19', time '09:00', time '13:00',  25, 'Classroom',
       'A morning preparing care packages for charity.', 'Give back as a team before the year ends.',
       'A room with long tables.', 'Step-free access.', 'None.', 'Sign-up through team leads.',
       'Briefing, packing, wrap-up.', 'Storage for donated goods.', null),
      ('Winter Networking Mixer',    1, 1, 'Approved',  date '2026-12-08', time '18:00', time '21:00', 100, 'Banquet',
       'An evening of networking for clients and staff.', 'Build relationships ahead of the new year.',
       'A space with a view and room to mingle.', 'Lift access.', 'Two PA speakers.', 'Clients register in advance.',
       'Welcome drinks, a short talk, networking.', 'Canapes for 100.', 'Wi-Fi'),
      ('Year-End Town Hall',         2, 1, 'Approved',  date '2026-12-10', time '14:00', time '17:00', 250, 'Theatre',
       'The all-staff town hall closing the year.', 'Share the year''s results and next year''s goals.',
       'A hall that seats 250 with a stage.', 'Step-free access and a hearing loop.', 'None.', 'All staff, no registration.',
       'Results, awards, then questions.', 'Reserved seats for the leadership team.', 'Wi-Fi'),
      ('Client Appreciation Dinner', 1, 1, 'Approved',  date '2026-12-12', time '18:00', time '22:00', 150, 'Banquet',
       'A formal dinner thanking the year''s clients.', 'Thank clients and renew relationships.',
       'A hall that takes round tables for 150.', 'Step-free route to the stage.', 'Four wireless microphones.', 'Invitation only.',
       'Reception, dinner, speeches.', 'Halal and vegetarian menus.', 'Catering area'),
      ('Product Roadmap Workshop',   2, 2, 'Approved',  date '2026-12-15', time '09:00', time '12:00',  35, 'Classroom',
       'A hands-on workshop on the product roadmap.', 'Agree next year''s product priorities.',
       'A room with tables for 35.', 'Lift access.', 'One projector.', 'Product team only.',
       'Context, group work, priorities.', 'Whiteboards at every table.', 'Video-conferencing'),
      ('Annual Customer Conference', 1, 1, 'Approved',  date '2026-12-18', time '09:00', time '17:00', 180, 'Theatre',
       'A full-day conference for customers.', 'Showcase the year''s work and next year''s plans.',
       'A room that seats 180 with a stage.', 'Step-free access and a hearing loop.', 'Projectors, microphones and a livestream kit.', 'Attendees register in advance; no walk-ins.',
       'Keynote, three talks, panel, closing.', 'Lunch and two coffee breaks.', 'Wi-Fi, Video-conferencing'),
      ('Autumn Partner Summit',      2, 1, 'Approved',  date '2026-10-20', time '10:00', time '16:00',  50, 'Theatre',
       'A summit with the partners of the region.', 'Align partners on the winter season.',
       'A room that seats 50.', 'Step-free access.', 'One projector.', 'Invited partners only.',
       'Talks in the morning, working groups after lunch.', 'Lunch for 50.', 'Wi-Fi'),
      ('Holiday Charity Gala',       1, 2, 'Approved',  date '2026-12-20', time '12:00', time '17:00', 120, 'Banquet',
       'A charity lunch and auction for the holidays.', 'Raise funds for the year''s chosen charity.',
       'A hall that takes round tables.', 'Lift access.', 'Two wireless microphones.', 'Tickets sold in advance.',
       'Lunch, auction, closing remarks.', 'Auction tables by the entrance.', 'Catering area')
    ) as t (name, organiser, coordinator, status, on_date, starts, ends, attendance, layout,
            description, purpose, venue_needs, accessibility, equipment, registration,
            programme, arrangements, facilities)
  loop
    select event_request_id into v_request
    from public.organiser_submit_event_request(
      r.name, r.description, r.purpose, r.on_date, r.starts, r.ends, r.attendance, r.venue_needs,
      r.layout, r.accessibility, r.equipment, r.registration, r.programme, r.arrangements,
      case r.status when 'Draft' then 'Draft' else 'Submitted' end,
      case r.organiser when 1 then v_organiser_1 else v_organiser_2 end,
      v_organisation
    );

    if r.coordinator = 0 then
      continue;
    end if;

    v_coordinator := case r.coordinator when 1 then v_coord_1 else v_coord_2 end;
    perform public.operations_assign_event_coordinator(v_request, v_coordinator);

    case r.status
      when 'Returned' then
        perform public.coordinator_return_event_request(v_request, v_coordinator,
          'How many suppliers are confirmed so far, and do you need a stage for the awards?');
      when 'Rejected' then
        perform public.coordinator_decide_event_request(v_request, v_coordinator, 'Rejected',
          'No venue holds 400 in an exhibition layout. Please resubmit for 150 or fewer.');
      when 'Withdrawn' then
        perform public.coordinator_withdraw_event_request(v_request, v_coordinator,
          'The organiser moved this to the new year and will submit it again.');
      when 'Approved' then
        perform public.coordinator_decide_event_request(v_request, v_coordinator, 'Approved',
          'Approved as requested.');
        select event_id into v_event from public.event where event_request_id = v_request;
        perform public.coordinator_set_event_required_facilities(v_coordinator, v_event, r.facilities);
        perform public.coordinator_update_event_details(v_coordinator, v_event, jsonb_build_object(
          'category_type',
          case when r.name in ('Client Appreciation Dinner', 'Holiday Charity Gala', 'Winter Networking Mixer')
               then 'Social' when r.name = 'Year-End Town Hall' then 'Internal'
               when r.name = 'Product Roadmap Workshop' then 'Workshop' else 'Conference' end,
          'operational_notes', 'Organiser is the day-of contact; confirm the run sheet a week before.'));
        update public.event set event_capacity = r.attendance where event_id = v_event;
        insert into public.event_essential_arrangement (event_id, arrangement_type)
        values (v_event, 'venue'), (v_event, 'programme');
      else
        null; -- Under Review: assigning it put it there.
    end case;
  end loop;

  -- 4. Bookings, on the event's own date and time, requested by its coordinator.
  for b in
    select e.event_id, e.assigned_coordinator_user_account_id as coordinator, e.name,
           t.location, t.layout, t.decision, t.note,
           (select jsonb_agg(jsonb_build_object('date', es.slot_date, 'slot', es.slot_code))
            from public.event_slot es where es.event_id = e.event_id) as slots
    from (values
      ('Winter Networking Mixer',    'Rooftop Terrace',     'Banquet', null,      null),
      ('Year-End Town Hall',         'UAT-44 Harbour Room', 'Theatre', 'reject',  'The Harbour Room seats 200 in a theatre layout; this event expects 250.'),
      ('Year-End Town Hall',         'Main Hall',           'Theatre', 'hold',    null),
      ('Client Appreciation Dinner', 'Main Hall',           'Banquet', 'approve', null),
      ('Product Roadmap Workshop',   'Seminar Room 2-1',    'Classroom', 'approve', null),
      ('Annual Customer Conference', 'UAT-44 Harbour Room', 'Theatre', 'approve', null),
      ('Autumn Partner Summit',      'Studio',              'Theatre', 'approve', null),
      ('Holiday Charity Gala',       'UAT-44 Garden Hall',  'Banquet', 'approve', null)
    ) as t (event_name, location, layout, decision, note)
    join public.event e on e.name = t.event_name
  loop
    v_booking := public.coordinator_submit_booking_request(
      b.coordinator, b.event_id, (select venue_id from public.venue where location = b.location),
      b.layout, b.slots);

    if b.decision is not null then
      perform public.venue_staff_decide_booking(
        v_staff, v_booking, b.decision, b.note, null,
        case when b.decision = 'hold' then now() + interval '21 days' end);
    end if;
  end loop;

  -- 5. Equipment: requested by the coordinator, reserved by Technical Support unless it is
  --    still waiting for them. Done before the safety checks, which a later change withdraws.
  for l in
    select e.event_id, e.assigned_coordinator_user_account_id as coordinator, i.equipment_item_id,
           t.quantity, t.essential, t.reserve, t.notes
    from (values
      ('Winter Networking Mixer',    'PA speaker',          2, false, false, 'Positioned at either end of the terrace.'),
      ('Client Appreciation Dinner', 'Wireless microphone', 4, true,  true,  'Handheld, for the speeches.'),
      ('Product Roadmap Workshop',   'Projector',           1, true,  true,  'HDMI input.'),
      ('Annual Customer Conference', 'Projector',           2, true,  true,  'Mounted either side of the stage.'),
      ('Annual Customer Conference', 'Wireless microphone', 6, true,  true,  'Four handheld for the panel, two for questions.'),
      ('Annual Customer Conference', 'Livestream kit',      1, false, true,  'Streams the keynote only.'),
      ('Autumn Partner Summit',      'Projector',           1, false, true,  'HDMI input.'),
      ('Holiday Charity Gala',       'Wireless microphone', 2, false, true,  'For the auctioneer.')
    ) as t (event_name, item, quantity, essential, reserve, notes)
    join public.event e on e.name = t.event_name
    join public.equipment_item i on i.type = t.item
  loop
    perform public.coordinator_add_equipment_requirement(
      l.event_id, l.coordinator, l.equipment_item_id, l.quantity, l.notes);
    if l.essential then
      perform public.coordinator_set_equipment_line_essential(
        l.event_id, l.coordinator, l.equipment_item_id, true);
    end if;
    if l.reserve then
      perform public.technical_support_reserve_equipment(
        v_support, l.event_id, l.equipment_item_id, l.quantity);
    end if;
  end loop;

  -- 6. Safety checks, confirmation, and the two events past Confirmed.
  for r in
    select event_id, name, assigned_coordinator_user_account_id as coordinator
    from public.event
    where name in ('Product Roadmap Workshop', 'Annual Customer Conference',
                   'Autumn Partner Summit', 'Holiday Charity Gala')
  loop
    perform public.safety_officer_record_safety_check(v_safety, r.event_id, 'Approved',
      'Exits, capacity and accessible routes all checked.');
    if r.name = 'Product Roadmap Workshop' then
      continue;
    end if;

    if r.name = 'Annual Customer Conference' then
      perform public.coordinator_set_event_registration(
        r.coordinator, r.event_id, true, date '2026-10-01', date '2026-12-16');
      insert into public.event_essential_arrangement (event_id, arrangement_type)
      values (r.event_id, 'registration');
    end if;

    perform public.coordinator_confirm_event(r.event_id, r.coordinator);

    if r.name = 'Autumn Partner Summit' then
      perform public.coordinator_complete_event(r.coordinator, r.event_id,
        'Ran to time. Partners asked for a longer working session next year.');
    elsif r.name = 'Holiday Charity Gala' then
      perform public.coordinator_cancel_event(r.coordinator, r.event_id);
    end if;
  end loop;

  -- 7. The Confirmed event's registrants and open change request.
  select event_id, event_request_id into v_event, v_request
  from public.event where name = 'Annual Customer Conference';

  perform public.attendee_register(gen_random_uuid(), v_event, t.name, t.email, 'Registered', timestamptz '2026-10-20 10:00+08')
  from (values
    ('Alex Tan',    'alex.tan@example.com'),
    ('Priya Nair',  'priya.nair@example.com'),
    ('Sam Lim',     'sam.lim@example.com')
  ) as t (name, email);

  perform public.submit_change_request(v_request, v_organiser_1,
    jsonb_build_array(jsonb_build_object('field_name', 'expected_attendance', 'requested_value', '195')));

  -- 8. Venue blocks. Three are clear of every booking; the Equipment failure block lands on the
  --    Year-End Town Hall's hold on purpose, which raises the one open flag.
  for r in
    select t.location, t.reason, t.first_date, t.last_date, t.first_slot, t.last_slot, t.lifted
    from (values
      ('Studio',           'Safety',            date '2026-12-05', date '2026-12-05', 52, 71, true),
      ('Seminar Room 2-1', 'Maintenance',       date '2026-12-09', date '2026-12-09', 28, 95, false),
      ('Main Hall',        'Equipment failure', date '2026-12-10', date '2026-12-10', 60, 63, false),
      ('Rooftop Terrace',  'Renovation',        date '2026-12-21', date '2026-12-23', 28, 95, false)
    ) as t (location, reason, first_date, last_date, first_slot, last_slot, lifted)
  loop
    v_id := public.venue_staff_record_unavailability(
      v_staff, (select venue_id from public.venue where location = r.location), r.reason, null,
      (select jsonb_agg(jsonb_build_object('date', d::date, 'slot', n::text))
       from generate_series(r.first_date::timestamp, r.last_date::timestamp, interval '1 day') d,
            generate_series(r.first_slot, r.last_slot) n));
    if r.lifted then
      perform public.venue_staff_lift_unavailability(v_staff, v_id);
    end if;
  end loop;
end;
$$;
