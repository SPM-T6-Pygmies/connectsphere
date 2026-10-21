-- SPM-321: Venue Staff block a venue for a time of day, not a slot (SPM-276 AC4/AC5).
--
-- 1. Existing blocks move onto the 15-minute codes: AM -> '28'-'47', PM -> '52'-'71',
--    Night -> '76'-'95', the same conversion the opening hours had in 20261020010000. A
--    block covers exactly the time it did.
-- 2. Bookings are still on AM, PM and Night until SPM-324/325, so "is this booking slot
--    blocked?" can no longer compare slot codes: a block on '36'-'45' (09:00-11:30) would
--    never equal AM. `venue_slot_blocked` compares by time, half-open, and the four places
--    that refuse a booking over a block call it: the booking_slot insert trigger, approving
--    or holding a request, and confirming a hold. Each is its latest definition with only
--    that check replaced.
-- 3. Recording a block refuses time the venue is closed (CS078) -- the backstop for the
--    form and the use case, which refuse it first and name the closed time.
-- 4. The calendar and list reads order by the slot's start time, not by AM/PM/Night.
--
-- Hours narrowed after a block was recorded are not rechecked: a block stays as recorded.

begin;

-- ---------------------------------------------------------------------------
-- 1. Convert the existing blocks.
-- ---------------------------------------------------------------------------
insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
select us.venue_unavailability_id, us.slot_date, s.slot_code
from public.venue_unavailability_slot us
join public.slot old on old.slot_code = us.slot
join public.slot s
  on s.start_time >= old.start_time
 and s.end_time   <= old.end_time
 and s.slot_code ~ '^[0-9]+$'
where us.slot in ('AM', 'PM', 'Night')
on conflict do nothing;

delete from public.venue_unavailability_slot where slot in ('AM', 'PM', 'Night');

-- ---------------------------------------------------------------------------
-- 2. One rule for "is this venue slot blocked?", by time.
-- ---------------------------------------------------------------------------
create or replace function public.venue_slot_blocked(
  p_venue_id bigint,
  p_slot_date date,
  p_slot text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.venue_unavailability_slot us
    join public.venue_unavailability u
      on u.venue_unavailability_id = us.venue_unavailability_id
    join public.slot blocked on blocked.slot_code = us.slot
    join public.slot asked on asked.slot_code = p_slot
    where us.venue_id = p_venue_id
      and us.slot_date = p_slot_date
      and u.lifted_at is null
      -- Half-open: a block ending at 12:00 does not touch a slot starting at 12:00.
      and blocked.start_time < asked.end_time
      and asked.start_time < blocked.end_time
  );
$$;

create or replace function public.booking_slot_refuse_blocked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('Requested', 'Tentative Hold', 'Confirmed')
     and public.venue_slot_blocked(new.venue_id, new.slot_date, new.slot) then
    raise exception 'Venue % is blocked for % %', new.venue_id, new.slot_date, new.slot
      using errcode = 'CS028';
  end if;
  return new;
end;
$$;

-- Approving or holding a request: its latest definition (20261019000300), with the block check by time.
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
    select string_agg(mine.slot_date::text || ' ' || mine.slot, ', ' order by mine.slot_date, mine.slot)
    into v_blocked
    from public.booking_slot mine
    where mine.booking_id = p_booking_id
      and exists (
        select 1
        where public.venue_slot_blocked(v_venue_id, mine.slot_date, mine.slot)
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

-- Confirming a hold: its definition (20261018000400), with the block check by time.
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
    select string_agg(mine.slot_date::text || ' ' || mine.slot, ', ' order by mine.slot_date, mine.slot)
    into v_blocked
    from public.booking_slot mine
    where mine.booking_id = p_booking_id
      and exists (
        select 1
        where public.venue_slot_blocked(v_venue_id, mine.slot_date, mine.slot)
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

-- ---------------------------------------------------------------------------
-- 3. Recording refuses closed time.
-- ---------------------------------------------------------------------------
create or replace function public.venue_staff_record_unavailability(
  p_staff_user_account_id bigint,
  p_venue_id bigint,
  p_reason text,
  p_note text,
  p_slots jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not exists (
    select 1
    from public.user_account_role uar
    join public.role r on r.role_id = uar.role_id
    where uar.user_account_id = p_staff_user_account_id
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Only Venue Staff can mark a venue unavailable.' using errcode = 'CS036';
  end if;

  -- The same lock a booking request and a decision take.
  perform 1 from public.venue where venue_id = p_venue_id for update;
  if not found then
    raise exception 'That venue is not in the catalogue.' using errcode = 'CS039';
  end if;

  -- Only open time can be blocked. The core refuses it first and names the closed time; this
  -- is the backstop for a caller that does not go through it.
  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where not exists (
      select 1 from public.venue_slot vs
      where vs.venue_id = p_venue_id and vs.slot_code = s ->> 'slot'
    )
  ) then
    raise exception 'A block can only cover time the venue is open.' using errcode = 'CS078';
  end if;

  insert into public.venue_unavailability
    (venue_id, reason_category, reason_note, recorded_by_user_account_id)
  values (p_venue_id, p_reason, p_note, p_staff_user_account_id)
  returning venue_unavailability_id into v_id;

  insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
  select v_id, (s ->> 'date')::date, s ->> 'slot'
  from jsonb_array_elements(p_slots) s;

  -- A hold that has run out holds nothing, so it is marked Expired before the check.
  perform public.expire_lapsed_holds(p_venue_id);

  -- Overlap is by time, not by slot code, so it holds while bookings and blocks sit on
  -- different grids (AM/PM/Night on one side, the 15-minute codes of SPM-331 on the other).
  -- Half-open: a block that only touches a booking does not overlap it. The reason names
  -- the block's own hours that clash with the booking, joined where they run into each other.
  with hits as (
    select distinct b.booking_id, us.slot_date, bl.start_time, bl.end_time
    from public.booking b
    join public.booking_slot bs on bs.booking_id = b.booking_id
    join public.slot sl on sl.slot_code = bs.slot
    join public.venue_unavailability_slot us
      on us.venue_unavailability_id = v_id
     and us.slot_date = bs.slot_date
    join public.slot bl on bl.slot_code = us.slot
     and bl.start_time < sl.end_time
     and sl.start_time < bl.end_time
    where b.venue_id = p_venue_id
      and public.booking_holds_slot(b.status, b.hold_expires_at)
  )
  insert into public.booking_review_flag (booking_id, reason_code, source_ref, detail)
  select booking_id,
         'venue-unavailable',
         v_id::text,
         p_reason || ': ' || public.merge_time_spans(jsonb_agg(
           jsonb_build_object('date', slot_date, 'start', start_time, 'end', end_time)))
  from hits
  group by booking_id
  on conflict (booking_id, reason_code, source_ref) where cleared_at is null do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reads ordered by the slot's start time.
-- ---------------------------------------------------------------------------
create or replace function public.venue_blocked_slots(
  p_venue_id bigint,
  p_from date,
  p_to date
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', s.venue_id,
             'date', s.slot_date,
             'slot', s.slot,
             'reason_category', u.reason_category,
             'reason_note', u.reason_note)
           order by s.venue_id, s.slot_date, sl.start_time, u.venue_unavailability_id), '[]'::jsonb)
  from public.venue_unavailability_slot s
  join public.slot sl on sl.slot_code = s.slot
  join public.venue_unavailability u
    on u.venue_unavailability_id = s.venue_unavailability_id
  where auth.uid() is not null
    and u.lifted_at is null
    and (p_venue_id is null or s.venue_id = p_venue_id)
    and s.slot_date between p_from and p_to;
$$;

create or replace function public.venue_staff_unavailability(
  p_staff_user_account_id bigint,
  p_unavailability_id bigint default null
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', u.venue_unavailability_id,
      'venue_id', u.venue_id,
      'venue_location', v.location,
      'reason_category', u.reason_category,
      'reason_note', u.reason_note,
      'status', case when u.lifted_at is null then 'In force' else 'Lifted' end,
      'recorded_by_name', rb.name,
      'recorded_at', u.recorded_at,
      'lifted_by_name', lb.name,
      'lifted_at', u.lifted_at,
      'start_date', (select min(s.slot_date) from public.venue_unavailability_slot s
                     where s.venue_unavailability_id = u.venue_unavailability_id),
      'end_date', (select max(s.slot_date) from public.venue_unavailability_slot s
                   where s.venue_unavailability_id = u.venue_unavailability_id),
      'slots', (
        select coalesce(jsonb_agg(
                 jsonb_build_object('date', s.slot_date, 'slot', s.slot)
                 order by s.slot_date, sl.start_time
               ), '[]'::jsonb)
        from public.venue_unavailability_slot s
        join public.slot sl on sl.slot_code = s.slot
        where s.venue_unavailability_id = u.venue_unavailability_id
      )
    )
    order by u.venue_unavailability_id
  ), '[]'::jsonb)
  from public.venue_unavailability u
  join public.venue v on v.venue_id = u.venue_id
  join public.user_account rb on rb.user_account_id = u.recorded_by_user_account_id
  left join public.user_account lb on lb.user_account_id = u.lifted_by_user_account_id
  where exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        )
    and (p_unavailability_id is null or u.venue_unavailability_id = p_unavailability_id);
$$;

-- The bookings a block sits over: a booking slot that shares time with any slot of the block.
-- A booking is listed once per slot of its own that overlaps, as before.
create or replace function public.venue_staff_unavailability_affected(
  p_staff_user_account_id bigint,
  p_venue_id bigint,
  p_slots jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'booking_id', b.booking_id,
      'event_name', e.name,
      'status', b.status,
      'date', bs.slot_date,
      'slot', bs.slot
    )
    order by bs.slot_date, booked.start_time, b.booking_id
  ), '[]'::jsonb)
  from public.booking_slot bs
  join public.slot booked on booked.slot_code = bs.slot
  join public.booking b on b.booking_id = bs.booking_id
  join public.event e on e.event_id = b.event_id
  where bs.venue_id = p_venue_id
    and b.status in ('Requested', 'Tentative Hold', 'Confirmed')
    and exists (
          select 1
          from jsonb_array_elements(p_slots) s
          join public.slot blocked on blocked.slot_code = s ->> 'slot'
          where (s ->> 'date')::date = bs.slot_date
            and blocked.start_time < booked.end_time
            and booked.start_time < blocked.end_time
        )
    and exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        );
$$;

commit;
