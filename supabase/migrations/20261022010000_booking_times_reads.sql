-- SPM-324 (SPM-276 team decision 6, CR-W7-01): bookings are read as start and
-- end times, ready for their slots to move to the 15-minute grid.
--
-- Nothing here depends on which codes booking_slot holds: every read takes a
-- row's hours from `slot`, and AM ('07:00'-'12:00') reads the same way as
-- '28' ('07:00'-'07:15'). The next migration converts the rows.
--
-- 1. slots_overlap(a, b): whether two slot codes share any time, by their
--    hours in `slot`. Blocks stay on AM, PM and Night until SPM-321, so a
--    booking's 15-minute slot must be compared with a block by time, never by
--    code: '28' = 'AM' is false, and a block would stop refusing anything.
-- 2. The block checks use it: the booking_slot insert trigger, approving or
--    holding a request, confirming a hold, and the bookings a block affects.
--    Their refusals name times, not codes.
-- 3. The reads report each booking_slot row as {date, start, end} instead of
--    {date, slot}, as SPM-326 did for events: venue_booked_slots,
--    coordinator_event_bookings, the booking inside venue_staff_bookings and
--    claim_expired_hold_notices. The core joins touching rows back into
--    times. Order is by start_time, never by code ('10' < '2').
--
-- The clash between two bookings stays an equality check on (venue, date,
-- slot): once every booking is on the 15-minute grid, overlapping times share
-- a code, and the unique index refuses a double booking unchanged.

begin;

-- ---------------------------------------------------------------------------
-- 1. Whether two slots share any time
-- ---------------------------------------------------------------------------
create function public.slots_overlap(p_a text, p_b text)
returns boolean
language sql
stable
set search_path = ''
as $$
  -- Half-open: a slot ending as the other starts does not overlap it.
  select exists (
    select 1
    from public.slot a
    join public.slot b
      on a.start_time < b.end_time
     and b.start_time < a.end_time
    where a.slot_code = p_a
      and b.slot_code = p_b
  );
$$;

revoke execute on function public.slots_overlap(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Block checks by time
-- ---------------------------------------------------------------------------
create or replace function public.booking_slot_refuse_blocked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('Requested', 'Tentative Hold', 'Confirmed')
     and exists (
       select 1
       from public.venue_unavailability_slot us
       join public.venue_unavailability u
         on u.venue_unavailability_id = us.venue_unavailability_id
       where us.venue_id = new.venue_id
         and us.slot_date = new.slot_date
         and public.slots_overlap(us.slot, new.slot)
         and u.lifted_at is null
     ) then
    raise exception 'Venue % is blocked for % %', new.venue_id, new.slot_date,
      (select to_char(s.start_time, 'HH24:MI') || '–' || to_char(s.end_time, 'HH24:MI')
       from public.slot s where s.slot_code = new.slot)
      using errcode = 'CS028';
  end if;
  return new;
end;
$$;

create or replace function public.venue_staff_decide_booking(
  p_staff_user_account_id bigint,
  p_booking_id bigint,
  p_decision text,
  p_note text,
  p_suggested_alternative_venue_id bigint,
  p_hold_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
  v_note text := nullif(btrim(p_note), '');
  v_clash text;
  v_blocked text;
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

  select status into v_status from public.booking where booking_id = p_booking_id;
  if v_status <> 'Requested' then
    raise exception 'Booking % is already %', p_booking_id, v_status using errcode = 'CS031';
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

    select string_agg(bs.slot_date::text || ' ' || bs.slot, ', ' order by bs.slot_date, bs.slot)
    into v_clash
    from public.booking_slot bs
    join public.booking_slot mine
      on mine.slot_date = bs.slot_date and mine.slot = bs.slot and mine.booking_id = p_booking_id
    join public.booking other on other.booking_id = bs.booking_id
    where other.venue_id = v_venue_id
      and other.booking_id <> p_booking_id
      and public.booking_holds_slot(other.status, other.hold_expires_at);

    if v_clash is not null then
      raise exception 'Venue % is already booked for %', v_venue_id, v_clash
        using errcode = 'CS025';
    end if;

    -- A lapsed hold still sits in booking_slot_no_double_booking_uidx until it is
    -- marked, so mark this venue's lapsed holds Expired (SPM-253) before this
    -- booking takes its slots. The venue is already locked above.
    perform public.expire_lapsed_holds(v_venue_id);

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
$$;

create or replace function public.venue_staff_resolve_hold(
  p_staff_user_account_id bigint,
  p_booking_id bigint,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
  v_expires timestamptz;
  v_blocked text;
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

  if p_resolution not in ('confirm', 'release') then
    raise exception 'Unknown resolution %', p_resolution;
  end if;

  -- The same lock a booking request and a decision take.
  perform 1 from public.venue where venue_id = v_venue_id for update;

  select status, hold_expires_at into v_status, v_expires
  from public.booking
  where booking_id = p_booking_id;

  if v_status <> 'Tentative Hold' or not public.booking_holds_slot(v_status, v_expires) then
    raise exception 'Booking % is not a live hold', p_booking_id using errcode = 'CS074';
  end if;

  if p_resolution = 'confirm' then
    -- A block recorded after the hold still wins: the insert trigger never saw it.
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

    update public.booking
    set status = 'Confirmed',
        decided_by_user_account_id = p_staff_user_account_id,
        hold_expires_at = null,
        updated_at = now()
    where booking_id = p_booking_id;
  else
    update public.booking
    set status = 'Released',
        decided_by_user_account_id = p_staff_user_account_id,
        updated_at = now()
    where booking_id = p_booking_id;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_staff_user_account_id, 'booking', p_booking_id, p_resolution || ' hold');
end;
$$;

-- One entry per affected booking slot, as {date, start, end}; the core joins
-- a booking's touching slots on a date back into one time.
create or replace function public.venue_staff_unavailability_affected(
  p_staff_user_account_id bigint,
  p_venue_id bigint,
  p_slots jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'booking_id', a.booking_id,
      'event_name', a.event_name,
      'status', a.status,
      'date', a.slot_date,
      'start', a.start_time,
      'end', a.end_time
    )
    order by a.slot_date, a.start_time, a.booking_id
  ), '[]'::jsonb)
  from (
    -- A block's slots never overlap each other, but one may be given twice.
    select distinct b.booking_id, e.name as event_name, b.status, bs.slot_date, sl.start_time, sl.end_time
    from jsonb_array_elements(p_slots) s
    join public.booking_slot bs
      on bs.venue_id = p_venue_id
     and bs.slot_date = (s ->> 'date')::date
     and public.slots_overlap(bs.slot, s ->> 'slot')
    join public.slot sl on sl.slot_code = bs.slot
    join public.booking b on b.booking_id = bs.booking_id
    join public.event e on e.event_id = b.event_id
    where b.status in ('Requested', 'Tentative Hold', 'Confirmed')
      and exists (
            select 1
            from public.user_account_role uar
            join public.role r on r.role_id = uar.role_id
            where uar.user_account_id = p_staff_user_account_id
              and r.role_name = 'Venue Staff'
          )
  ) a;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reads report times
-- ---------------------------------------------------------------------------
drop function public.venue_booked_slots(bigint, date[]);

create function public.venue_booked_slots(p_venue_id bigint, p_dates date[])
returns table (slot_date date, start_time time, end_time time, status text, hold_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select bs.slot_date, sl.start_time, sl.end_time, b.status, b.hold_expires_at
  from public.booking_slot bs
  join public.slot sl on sl.slot_code = bs.slot
  join public.booking b on b.booking_id = bs.booking_id
  where b.venue_id = p_venue_id
    and bs.slot_date = any (p_dates)
  order by bs.slot_date, sl.start_time;
$$;

revoke execute on function public.venue_booked_slots(bigint, date[]) from public;
grant execute on function public.venue_booked_slots(bigint, date[]) to anon, authenticated;

create or replace function public.coordinator_event_bookings(
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
  suggested_alternative_location text
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
    av.location
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  where b.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by b.created_at desc;
$$;

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

create or replace function public.claim_expired_hold_notices()
returns table (
  booking_id bigint,
  event_id bigint,
  event_request_id bigint,
  event_name text,
  coordinator_user_account_id bigint,
  venue_location text,
  hold_expires_at timestamptz,
  slots jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.expire_lapsed_holds();

  return query
  with unclaimed as (
    select b.booking_id
    from public.booking b
    where b.status = 'Expired'
      and b.expiry_notified_at is null
      and b.event_id is not null
    order by b.booking_id
    for update skip locked
  ),
  claimed as (
    update public.booking b
    set expiry_notified_at = now()
    from unclaimed
    where b.booking_id = unclaimed.booking_id
    returning b.booking_id, b.event_id, b.venue_id, b.hold_expires_at
  )
  select
    c.booking_id,
    e.event_id,
    e.event_request_id,
    e.name,
    e.assigned_coordinator_user_account_id,
    v.location,
    c.hold_expires_at,
    (
      select coalesce(jsonb_agg(
               jsonb_build_object('date', bs.slot_date, 'start', sl.start_time, 'end', sl.end_time)
               order by bs.slot_date, sl.start_time
             ), '[]'::jsonb)
      from public.booking_slot bs
      join public.slot sl on sl.slot_code = bs.slot
      where bs.booking_id = c.booking_id
    )
  from claimed c
  join public.event e on e.event_id = c.event_id
  join public.venue v on v.venue_id = c.venue_id
  order by c.booking_id;
end;
$$;

commit;
