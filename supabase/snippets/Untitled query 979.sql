do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Founders'' Gala Dinner');
  v_coord bigint := (select user_account_id from public.user_account where name = 'Test Coordinator');
  v_staff bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_id bigint;
  d date := (now() at time zone 'Asia/Singapore')::date + 14;
  r record;
begin
  for r in
    select * from (values
      ('Studio',          d,     'AM',    'Requested'),   -- A: held in TC-VHOLD-001
      ('Studio',          d,     'AM',    'Requested'),   -- B: same slot as A, refused in TC-VHOLD-002
      ('Studio',          d + 1, 'PM',    'Requested'),   -- C: a different slot, unaffected
      ('Main Hall',       d + 2, 'Night', 'Confirmed'),   -- X: already confirmed
      ('Main Hall',       d + 2, 'Night', 'Requested'),   -- Y: same slot as X, refused in TC-VHOLD-003
      ('Main Hall',       current_date + 21, 'AM',    'Requested'),   -- D: over the expired hold, TC-VHOLD-004
      ('Main Hall',       current_date + 21, 'PM',    'Requested'),   -- E: over the live hold, TC-VHOLD-004
      ('Rooftop Terrace', d + 6, 'AM',    'Requested'),   -- F: blocked afterwards, TC-VHOLD-003
      ('UAT-44 Harbour Room', d + 3, 'AM', 'Requested')   -- G: held, then searched for, TC-VHOLD-002
    ) as t(venue, d, slot, status)
  loop
    insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
    values ((select venue_id from public.venue where location = r.venue), v_event, v_coord,
            case when r.status = 'Requested' then null else v_staff end, r.status)
    returning booking_id into v_id;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_id, r.d, r.slot);
  end loop;

  perform public.venue_staff_record_unavailability(
    v_staff, (select venue_id from public.venue where location = 'Rooftop Terrace'), 'Renovation', null,
    jsonb_build_array(jsonb_build_object('date', d + 6, 'slot', 'AM')));
end $$;
