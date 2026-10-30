-- SPM-251: the assigned Event Coordinator re-requests a venue for a flagged booking.
--
-- A re-request is an ordinary booking request (SPM-46) that names the flagged booking it
-- replaces. Nothing else about it is special: the same checks, the same Venue Staff queue.
--
--   booking.replaces_booking_id     set on the re-request when it is sent
--   booking.replaced_by_booking_id  set on the original when Venue Staff approve the re-request
--
-- 1. coordinator_submit_booking_request takes p_replaces_booking_id (default null, so an
--    ordinary request is sent as before). It locks the original's row and restates the core's
--    `bookingToReplace`:
--      CS026  the booking is not on this event (the event is already the coordinator's; #91)
--      CS085  it has no open flag, or no longer holds its venue (new)
--      CS086  a re-request for it is already waiting for Venue Staff (new). Two tabs sending at
--             once queue on the row lock and the second sees the first; the unique index below
--             backs that up.
--    The clash check (CS025) ignores the booking being replaced (AC5).
-- 2. booking_padded_clashes ignores the booking a re-request replaces, so Venue Staff's
--    padded check (CS082) does not refuse a re-request for its own original (AC5).
-- 3. venue_staff_decide_booking refuses a hold on a re-request (CS087, new; AC10). Approving
--    one replaces the original in the same transaction (AC6), if the original still holds its
--    venue: its open flags close as cleared_how = 'replaced' FIRST -- the SPM-313 trigger would
--    otherwise close them as 'booking-ended' when it is released -- then it becomes Released
--    with replaced_by_booking_id set and an audit row 'replace', and only then is the
--    re-request confirmed, so the one-booking-per-slot index never sees both live at once.
--    A rejection changes nothing on the original: it stays flagged (AC7).
-- 4. The reads report the links: venue_booked_slots which booking holds each slot,
--    coordinator_event_bookings both ids, venue_staff_bookings
--    the replaced booking's venue, times and status (AC4).
--
-- Same known gap as the other coordinator writes: the coordinator id is supplied by the
-- caller and execute is granted to anon, so this trusts the application's acting identity
-- until real authentication lands (#62).

begin;

-- ---------------------------------------------------------------------------
-- The links
-- ---------------------------------------------------------------------------
alter table public.booking
  add column replaces_booking_id bigint references public.booking (booking_id) on delete set null,
  add column replaced_by_booking_id bigint references public.booking (booking_id) on delete set null,
  add constraint booking_replaces_other_chk check (replaces_booking_id <> booking_id),
  add constraint booking_replaced_by_other_chk check (replaced_by_booking_id <> booking_id);

-- AC9: at most one re-request per booking waits for Venue Staff.
create unique index booking_one_waiting_re_request_uidx
  on public.booking (replaces_booking_id)
  where status = 'Requested';

-- ---------------------------------------------------------------------------
-- 1. Sending a re-request
-- ---------------------------------------------------------------------------
drop function public.coordinator_submit_booking_request(bigint, bigint, bigint, text, jsonb);

create function public.coordinator_submit_booking_request(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_venue_id bigint,
  p_room_layout text,
  p_slots jsonb,
  p_replaces_booking_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_layout_count integer;
  v_layout_id bigint;
  v_layout_name text := nullif(btrim(p_room_layout), '');
  v_slot_count integer;
  v_date text;
  v_booking_id bigint;
  v_clash text;
  v_event_status text;
  v_replaced_status text;
  v_replaced_hold_expires_at timestamptz;
begin
  -- `for share`, so a cancellation (which locks the event `for update`) waits
  -- for this request to land and then cancels it, or lands first and is seen.
  select status into v_event_status
  from public.event
  where event_id = p_event_id
    and assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for share;

  if not found then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
  end if;

  if v_event_status = 'Cancelled' then
    raise exception 'Event % is cancelled', p_event_id
      using errcode = 'CS077';
  end if;

  -- Serialises bookings against one venue, so two submissions -- or a future
  -- approval taking the same lock -- cannot both see a slot as free.
  perform 1 from public.venue where venue_id = p_venue_id for update;
  if not found then
    raise exception 'No venue %', p_venue_id using errcode = 'CS021';
  end if;

  -- SPM-251: the booking this request replaces. Its row is locked, so two re-requests for it
  -- queue here and the second sees the first.
  if p_replaces_booking_id is not null then
    select status, hold_expires_at into v_replaced_status, v_replaced_hold_expires_at
    from public.booking
    where booking_id = p_replaces_booking_id
      and event_id = p_event_id
    for update;

    if not found then
      raise exception 'No booking % on event %', p_replaces_booking_id, p_event_id
        using errcode = 'CS026';
    end if;

    if not public.booking_holds_slot(v_replaced_status, v_replaced_hold_expires_at)
       or not exists (
         select 1 from public.booking_review_flag f
         where f.booking_id = p_replaces_booking_id and f.cleared_at is null
       ) then
      raise exception 'Booking % has no open flag to re-request', p_replaces_booking_id
        using errcode = 'CS085';
    end if;

    if exists (
      select 1 from public.booking
      where replaces_booking_id = p_replaces_booking_id and status = 'Requested'
    ) then
      raise exception 'A re-request for booking % is already waiting', p_replaces_booking_id
        using errcode = 'CS086';
    end if;
  end if;

  select count(*) into v_layout_count
  from public.venue_supported_layout
  where venue_id = p_venue_id;

  if v_layout_name is not null then
    -- Matched by name, the way the catalogue keeps layouts (SPM-42), against
    -- the layouts this venue supports -- never the whole room_layout table.
    select vsl.room_layout_id into v_layout_id
    from public.venue_supported_layout vsl
    join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
    where vsl.venue_id = p_venue_id
      and lower(rl.name) = lower(v_layout_name);

    if v_layout_id is null then
      raise exception 'Layout % is not supported by venue %', v_layout_name, p_venue_id
        using errcode = 'CS023';
    end if;
  elsif v_layout_count > 1 then
    raise exception 'Venue % supports % layouts; choose one', p_venue_id, v_layout_count
      using errcode = 'CS022';
  elsif v_layout_count = 1 then
    select room_layout_id into v_layout_id
    from public.venue_supported_layout
    where venue_id = p_venue_id;
  end if;

  if p_slots is null
     or jsonb_typeof(p_slots) <> 'array'
     or jsonb_array_length(p_slots) = 0 then
    raise exception 'A booking request needs at least one slot' using errcode = 'CS024';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where jsonb_typeof(s) <> 'object'
       or coalesce(s ->> 'slot', '') !~ '^([0-9]|[1-8][0-9]|9[0-5])$'
       or coalesce(s ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
  ) then
    raise exception 'A slot is malformed' using errcode = 'CS024';
  end if;

  -- The right shape is not yet a real day: 2026-02-30 fails the cast.
  for v_date in select s ->> 'date' from jsonb_array_elements(p_slots) s loop
    begin
      perform v_date::date;
    exception when others then
      raise exception '% is not a calendar date', v_date using errcode = 'CS024';
    end;
  end loop;

  select count(distinct (s ->> 'date', s ->> 'slot')) into v_slot_count
  from jsonb_array_elements(p_slots) s;
  if v_slot_count <> jsonb_array_length(p_slots) then
    raise exception 'The same slot is requested more than once' using errcode = 'CS024';
  end if;

  -- SPM-251 AC5: a re-request never clashes with the booking it replaces.
  select string_agg(
           bs.slot_date::text || ' ' || to_char(sl.start_time, 'HH24:MI') || '–' || to_char(sl.end_time, 'HH24:MI'),
           ', ' order by bs.slot_date, sl.start_time)
  into v_clash
  from public.booking_slot bs
  join public.slot sl on sl.slot_code = bs.slot
  join public.booking b on b.booking_id = bs.booking_id
  join jsonb_array_elements(p_slots) s
    on bs.slot_date = (s ->> 'date')::date and bs.slot = s ->> 'slot'
  where b.venue_id = p_venue_id
    and b.booking_id is distinct from p_replaces_booking_id
    and public.booking_holds_slot(b.status, b.hold_expires_at);

  if v_clash is not null then
    raise exception 'Venue % is already booked for %', p_venue_id, v_clash
      using errcode = 'CS025';
  end if;

  begin
    insert into public.booking (
      venue_id,
      event_id,
      requested_by_user_account_id,
      status,
      room_layout_id,
      replaces_booking_id
    )
    values (
      p_venue_id,
      p_event_id,
      p_coordinator_user_account_id,
      'Requested',
      v_layout_id,
      p_replaces_booking_id
    )
    returning booking_id into v_booking_id;
  exception when unique_violation then
    -- booking_one_waiting_re_request_uidx: the row lock above makes this unreachable, but
    -- the answer is the same if it is ever reached.
    raise exception 'A re-request for booking % is already waiting', p_replaces_booking_id
      using errcode = 'CS086';
  end;

  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_booking_id, (s ->> 'date')::date, s ->> 'slot'
  from jsonb_array_elements(p_slots) s;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'booking', v_booking_id, 'request');

  return v_booking_id;
end;
$$;

revoke execute on function public.coordinator_submit_booking_request(bigint, bigint, bigint, text, jsonb, bigint)
  from public;
grant execute on function public.coordinator_submit_booking_request(bigint, bigint, bigint, text, jsonb, bigint)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The padded check ignores the booking a re-request replaces
-- ---------------------------------------------------------------------------
create or replace function public.booking_padded_clashes(p_booking_id bigint)
returns table (event_name text, clash_date date, clash_start time, clash_end time, is_hold boolean, hold_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with others as (
    select ev.name as event_name, w.window_start, w.window_end,
           (o.status = 'Tentative Hold') as is_hold, o.hold_expires_at
    from public.booking me
    join public.booking o on o.venue_id = me.venue_id and o.booking_id <> me.booking_id
    join public.event ev on ev.event_id = o.event_id
    cross join lateral public.booking_padded_windows(o.booking_id) w
    where me.booking_id = p_booking_id
      -- SPM-251 AC5: a re-request never clashes with the booking it replaces.
      and o.booking_id is distinct from me.replaces_booking_id
      and public.booking_holds_slot(o.status, o.hold_expires_at)
  ),
  shared as (
    select o.event_name,
           greatest(m.window_start, o.window_start) as shared_start,
           least(m.window_end, o.window_end) as shared_end,
           o.is_hold, o.hold_expires_at
    from public.booking_padded_windows(p_booking_id) m
    join others o on m.window_start < o.window_end and o.window_start < m.window_end
  ),
  per_date as (
    select s.event_name, d::date as day, s.shared_start, s.shared_end, s.is_hold, s.hold_expires_at
    from shared s
    cross join lateral generate_series(
      s.shared_start::date, (s.shared_end - interval '1 microsecond')::date, interval '1 day') d
  )
  select p.event_name,
         p.day,
         greatest(p.shared_start, p.day::timestamp)::time,
         case when p.shared_end >= (p.day + 1)::timestamp then time '24:00' else p.shared_end::time end,
         p.is_hold,
         p.hold_expires_at
  from per_date p
  order by p.day, 3;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deciding a re-request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_staff_decide_booking(p_staff_user_account_id bigint, p_booking_id bigint, p_decision text, p_note text, p_suggested_alternative_venue_id bigint, p_hold_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue_id bigint;
  v_status text;
  v_note text := nullif(btrim(p_note), '');
  v_blocked text;
  v_padded jsonb;
  v_replaces bigint;
  v_replaced_status text;
  v_replaced_hold_expires_at timestamptz;
begin
  if not exists (
    select 1
    from public.user_account_role uar
    join public.role r on r.role_id = uar.role_id
    where uar.user_account_id = p_staff_user_account_id
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Not Venue Staff' using errcode = 'CS030';
  end if;

  select venue_id into v_venue_id from public.booking where booking_id = p_booking_id;
  if not found then
    raise exception 'No booking %', p_booking_id using errcode = 'CS030';
  end if;

  -- The same lock a booking request takes, so a decision and a request, or two
  -- decisions, on one venue cannot both see a slot as free.
  perform 1 from public.venue where venue_id = v_venue_id for update;

  select status, replaces_booking_id into v_status, v_replaces
  from public.booking where booking_id = p_booking_id;
  if v_status <> 'Requested' then
    raise exception 'Booking % is already %', p_booking_id, v_status using errcode = 'CS031';
  end if;

  -- SPM-251 AC10: a re-request is approved or rejected, never held.
  if p_decision = 'hold' and v_replaces is not null then
    raise exception 'Booking % is a re-request and cannot be held', p_booking_id
      using errcode = 'CS087';
  end if;

  if p_decision = 'hold' and (p_hold_expires_at is null or p_hold_expires_at <= now()) then
    raise exception 'A hold needs an expiry in the future' using errcode = 'CS073';
  end if;

  if p_decision in ('approve', 'hold') then
    -- A block recorded after the request still wins: the insert trigger never
    -- saw it.
    select string_agg(
             mine.slot_date::text || ' ' || to_char(sl.start_time, 'HH24:MI') || '–' || to_char(sl.end_time, 'HH24:MI'),
             ', ' order by mine.slot_date, sl.start_time)
    into v_blocked
    from public.booking_slot mine
    join public.slot sl on sl.slot_code = mine.slot
    where mine.booking_id = p_booking_id
      and exists (
        select 1
        from public.venue_unavailability_slot us
        join public.venue_unavailability u
          on u.venue_unavailability_id = us.venue_unavailability_id
        where us.venue_id = v_venue_id
          and us.slot_date = mine.slot_date
          and public.slots_overlap(us.slot, mine.slot)
          and u.lifted_at is null
      );

    if v_blocked is not null then
      raise exception 'Venue % is blocked for %', v_venue_id, v_blocked
        using errcode = 'CS028';
    end if;

    -- SPM-19: the booking's times, padded with the venue's setup before and turnaround after,
    -- against every live booking's padded times, holds included. This is the one overlap
    -- check: a booking whose own times are free can still start setting up while the room is
    -- being turned around for another event, and one whose times overlap is found the same
    -- way, so Venue Staff are told which event is in the way whichever it is. A re-request's
    -- own original is not in the way (SPM-251 AC5).
    select jsonb_agg(
             jsonb_build_object(
               'event', c.event_name,
               'date', c.clash_date,
               'start', to_char(c.clash_start, 'HH24:MI'),
               'end', case when c.clash_end = time '24:00' then '24:00' else to_char(c.clash_end, 'HH24:MI') end)
             || case when c.is_hold
                     then jsonb_build_object('holdExpiresAt', c.hold_expires_at)
                     else '{}'::jsonb end
             order by c.clash_date, c.clash_start)
    into v_padded
    from public.booking_padded_clashes(p_booking_id) c;

    if v_padded is not null then
      raise exception 'Venue % has another booking within this booking''s setup or turnaround time', v_venue_id
        using errcode = 'CS082', detail = v_padded::text;
    end if;

    -- A lapsed hold still sits in booking_slot_no_double_booking_uidx until it is
    -- marked, so mark this venue's lapsed holds Expired (SPM-253) before this
    -- booking takes its slots. The venue is already locked above.
    perform public.expire_lapsed_holds(v_venue_id);

    -- SPM-251 AC6: approving a re-request replaces the booking it names, before this one takes
    -- its slots, so the two are never live on the same slot. The flags close as replaced
    -- first: releasing the booking would otherwise close them as booking-ended.
    if p_decision = 'approve' and v_replaces is not null then
      select status, hold_expires_at into v_replaced_status, v_replaced_hold_expires_at
      from public.booking where booking_id = v_replaces
      for update;

      if public.booking_holds_slot(v_replaced_status, v_replaced_hold_expires_at) then
        update public.booking_review_flag
        set cleared_at = now(),
            cleared_by_user_account_id = p_staff_user_account_id,
            cleared_how = 'replaced'
        where booking_id = v_replaces
          and cleared_at is null;

        update public.booking
        set status = 'Released',
            replaced_by_booking_id = p_booking_id,
            updated_at = now()
        where booking_id = v_replaces;

        insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
        values (p_staff_user_account_id, 'booking', v_replaces, 'replace');
      end if;
    end if;

    if p_decision = 'hold' then
      update public.booking
      set status = 'Tentative Hold',
          decided_by_user_account_id = p_staff_user_account_id,
          hold_expires_at = p_hold_expires_at,
          rejection_note = null,
          suggested_alternative_venue_id = null,
          updated_at = now()
      where booking_id = p_booking_id;
    else
      update public.booking
      set status = 'Confirmed',
          decided_by_user_account_id = p_staff_user_account_id,
          rejection_note = null,
          suggested_alternative_venue_id = null,
          updated_at = now()
      where booking_id = p_booking_id;
    end if;
  elsif p_decision = 'reject' then
    if v_note is null then
      raise exception 'A rejection needs a reason' using errcode = 'CS032';
    end if;

    update public.booking
    set status = 'Rejected',
        decided_by_user_account_id = p_staff_user_account_id,
        rejection_note = v_note,
        suggested_alternative_venue_id = p_suggested_alternative_venue_id,
        updated_at = now()
    where booking_id = p_booking_id;
  else
    raise exception 'Unknown decision %', p_decision;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_staff_user_account_id, 'booking', p_booking_id, p_decision);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. The reads report the links
-- ---------------------------------------------------------------------------
-- Which booking holds each slot, so the core can leave a re-request's own original out of its
-- clash check (AC5) before the function above restates it.
drop function public.venue_booked_slots(bigint, date[]);

create function public.venue_booked_slots(p_venue_id bigint, p_dates date[])
returns table (booking_id bigint, slot_date date, start_time time, end_time time, status text, hold_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.booking_id, bs.slot_date, sl.start_time, sl.end_time, b.status, b.hold_expires_at
  from public.booking_slot bs
  join public.slot sl on sl.slot_code = bs.slot
  join public.booking b on b.booking_id = bs.booking_id
  where b.venue_id = p_venue_id
    and bs.slot_date = any (p_dates)
  order by bs.slot_date, sl.start_time;
$$;

revoke execute on function public.venue_booked_slots(bigint, date[]) from public;
grant execute on function public.venue_booked_slots(bigint, date[]) to anon, authenticated;

drop function public.coordinator_event_bookings(bigint, bigint);

create function public.coordinator_event_bookings(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns table (
  booking_id bigint,
  venue_id bigint,
  venue_location text,
  room_layout_name text,
  status text,
  hold_expires_at timestamptz,
  created_at timestamptz,
  slots jsonb,
  rejection_note text,
  suggested_alternative_venue_id bigint,
  suggested_alternative_location text,
  replaces_booking_id bigint,
  replaced_by_booking_id bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.booking_id,
    b.venue_id,
    v.location,
    rl.name,
    b.status,
    b.hold_expires_at,
    b.created_at,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'start', sl.start_time, 'end', sl.end_time)
                 order by bs.slot_date, sl.start_time
               )
        from public.booking_slot bs
        join public.slot sl on sl.slot_code = bs.slot
        where bs.booking_id = b.booking_id
      ),
      '[]'::jsonb
    ),
    b.rejection_note,
    b.suggested_alternative_venue_id,
    av.location,
    b.replaces_booking_id,
    b.replaced_by_booking_id
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  where b.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by b.created_at desc;
$$;

revoke execute on function public.coordinator_event_bookings(bigint, bigint) from public;
grant execute on function public.coordinator_event_bookings(bigint, bigint) to anon, authenticated;

create or replace function public.venue_staff_bookings(
  p_staff_user_account_id bigint,
  p_section text,
  p_booking_id bigint default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'booking_id', b.booking_id,
      'status', b.status,
      'venue_id', b.venue_id,
      'venue_location', v.location,
      'room_layout_name', rl.name,
      'slots', (
        select coalesce(jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'start', sl.start_time, 'end', sl.end_time)
                 order by bs.slot_date, sl.start_time
               ), '[]'::jsonb)
        from public.booking_slot bs
        join public.slot sl on sl.slot_code = bs.slot
        where bs.booking_id = b.booking_id
      ),
      'requested_by_name', rb.name,
      'requested_at', b.created_at,
      'decided_by_name', db.name,
      'hold_expires_at', b.hold_expires_at,
      'rejection_note', b.rejection_note,
      'suggested_alternative_location', av.location,
      -- SPM-251 AC4: the flagged booking a re-request replaces.
      'replaces', (
        select jsonb_build_object(
                 'booking_id', ob.booking_id,
                 'venue_location', ov.location,
                 'status', ob.status,
                 'slots', (
                   select coalesce(jsonb_agg(
                            jsonb_build_object('date', obs.slot_date, 'start', osl.start_time, 'end', osl.end_time)
                            order by obs.slot_date, osl.start_time
                          ), '[]'::jsonb)
                   from public.booking_slot obs
                   join public.slot osl on osl.slot_code = obs.slot
                   where obs.booking_id = ob.booking_id
                 ))
        from public.booking ob
        join public.venue ov on ov.venue_id = ob.venue_id
        where ob.booking_id = b.replaces_booking_id
      ),
      'event', jsonb_build_object(
        'event_id', e.event_id,
        'event_request_id', e.event_request_id,
        'coordinator_user_account_id', e.assigned_coordinator_user_account_id,
        'name', e.name,
        'status', e.status,
        'organisation_name', co.name,
        'category', e.category_type,
        'preferred_date', e.preferred_date,
        'slots', (
          select coalesce(jsonb_agg(
                   jsonb_build_object('date', es.slot_date, 'start', s.start_time, 'end', s.end_time)
                   order by es.slot_date, s.start_time
                 ), '[]'::jsonb)
          from public.event_slot es
          join public.slot s on s.slot_code = es.slot_code
          where es.event_id = e.event_id
        ),
        'expected_attendance', e.expected_attendance,
        'room_layout_preference', e.room_layout_preference,
        'accessibility_requirements', e.accessibility_requirements,
        'venue_requirements', e.venue_requirements,
        'equipment_requirements', e.equipment_requirements,
        'special_arrangements', e.special_arrangements
      )
    )
    order by b.created_at, b.booking_id
  ), '[]'::jsonb)
  from public.booking b
  join public.venue v on v.venue_id = b.venue_id
  join public.event e on e.event_id = b.event_id
  join public.client_organisation co on co.client_organisation_id = e.client_organisation_id
  join public.user_account rb on rb.user_account_id = b.requested_by_user_account_id
  left join public.user_account db on db.user_account_id = b.decided_by_user_account_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        )
    and (p_booking_id is null or b.booking_id = p_booking_id)
    and b.status = any (
      case p_section
        when 'requests' then array['Requested']
        when 'decided' then array['Tentative Hold', 'Confirmed']
        when 'archive' then array['Rejected', 'Released', 'Cancelled', 'Expired']
        else array['Requested', 'Tentative Hold', 'Confirmed', 'Rejected', 'Released', 'Cancelled', 'Expired']
      end
    );
$$;

commit;
