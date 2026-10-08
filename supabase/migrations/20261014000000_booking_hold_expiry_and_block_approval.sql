-- SPM-46 + SPM-22: close the booking clash gaps.
--
-- 1. Hold expiry (SPM-46 AC4). A booking holds its slots when it is
--    Confirmed, or a Tentative Hold whose hold_expires_at is null or later
--    than now(). `booking_holds_slot` states that once and every check below
--    calls it, so the rule exists in one place -- SPM-253 reuses it rather
--    than writing its own. It matches `holdsSlot` in src/core/domain/booking.ts.
--
--    A null expiry counts as live. Holds are not built yet (SPM-218), so
--    nothing should create one without an expiry; erring towards "held" means
--    a hold with a missing expiry keeps its slot rather than silently freeing it.
--
-- 2. Approving over an expired hold. booking_slot_no_double_booking_uidx keeps
--    every Tentative Hold row, expired or not, because an index predicate
--    cannot read now(). So before confirming, the approval marks expired holds
--    on the booking's own slots Released (with an audit row), under the venue
--    lock. The hold stays on record with its expiry time. Anything else that
--    confirms or holds a slot later must do the same until SPM-253 expires
--    holds on its own.
--
-- 3. Approving over a block (SPM-22). booking_slot_refuse_blocked fires on
--    insert only, so a booking Requested before a block was recorded could be
--    approved into the blocked slot. The approval now checks the booking's
--    slots against In force blocks and refuses with CS028, the code that
--    already means "held by a Venue Staff block". The block wins over the
--    request. Rejection is unaffected: a rejected booking holds nothing.
--
-- Redefined, each from its latest definition:
--   venue_booked_slots                  20261005000000 (now also returns hold_expires_at)
--   coordinator_submit_booking_request  20261005010000
--   venue_staff_decide_booking          20261005030000
--   venue_busy_intervals                20261007010000
-- booking_slot_refuse_blocked is left alone: it refuses new slots over a
-- block, which is unrelated to hold expiry.

begin;

-- ---------------------------------------------------------------------------
-- 1. The rule. `stable`, not `immutable`: it reads now().
-- ---------------------------------------------------------------------------
create or replace function public.booking_holds_slot(p_status text, p_hold_expires_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'Confirmed'
      or (p_status = 'Tentative Hold'
          and (p_hold_expires_at is null or p_hold_expires_at > now()));
$$;

-- ---------------------------------------------------------------------------
-- 2. What a venue carries on some dates, with each hold's expiry so the core
--    can apply the same rule. The return type changes, so drop and recreate.
-- ---------------------------------------------------------------------------
drop function if exists public.venue_booked_slots(bigint, date[]);

create function public.venue_booked_slots(
  p_venue_id bigint,
  p_dates date[]
)
returns table (slot_date date, slot text, status text, hold_expires_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select bs.slot_date, bs.slot, b.status, b.hold_expires_at
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  where b.venue_id = p_venue_id
    and bs.slot_date = any (p_dates);
$$;

-- ---------------------------------------------------------------------------
-- 3. The coordinator's request: an expired hold no longer blocks.
-- ---------------------------------------------------------------------------
create or replace function public.coordinator_submit_booking_request(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_venue_id bigint,
  p_room_layout text,
  p_slots jsonb
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
begin
  if not exists (
    select 1
    from public.event
    where event_id = p_event_id
      and assigned_coordinator_user_account_id = p_coordinator_user_account_id
  ) then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
  end if;

  -- Serialises bookings against one venue, so two submissions -- or a future
  -- approval taking the same lock -- cannot both see a slot as free.
  perform 1 from public.venue where venue_id = p_venue_id for update;
  if not found then
    raise exception 'No venue %', p_venue_id using errcode = 'CS021';
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
       or coalesce(s ->> 'slot', '') not in ('AM', 'PM', 'Night')
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

  select string_agg(bs.slot_date::text || ' ' || bs.slot, ', ' order by bs.slot_date, bs.slot)
  into v_clash
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  join jsonb_array_elements(p_slots) s
    on bs.slot_date = (s ->> 'date')::date and bs.slot = s ->> 'slot'
  where b.venue_id = p_venue_id
    and public.booking_holds_slot(b.status, b.hold_expires_at);

  if v_clash is not null then
    raise exception 'Venue % is already booked for %', p_venue_id, v_clash
      using errcode = 'CS025';
  end if;

  insert into public.booking (
    venue_id,
    event_id,
    requested_by_user_account_id,
    status,
    room_layout_id
  )
  values (
    p_venue_id,
    p_event_id,
    p_coordinator_user_account_id,
    'Requested',
    v_layout_id
  )
  returning booking_id into v_booking_id;

  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_booking_id, (s ->> 'date')::date, s ->> 'slot'
  from jsonb_array_elements(p_slots) s;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'booking', v_booking_id, 'request');

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Venue Staff's decision: a block refuses the approval, an expired hold
--    does not, and an expired hold on the slot is released before confirming.
-- ---------------------------------------------------------------------------
create or replace function public.venue_staff_decide_booking(
  p_staff_user_account_id bigint,
  p_booking_id bigint,
  p_decision text,
  p_note text,
  p_suggested_alternative_venue_id bigint
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

  if p_decision = 'approve' then
    -- A block recorded after the request still wins: the insert trigger never
    -- saw it.
    select string_agg(mine.slot_date::text || ' ' || mine.slot, ', ' order by mine.slot_date, mine.slot)
    into v_blocked
    from public.booking_slot mine
    where mine.booking_id = p_booking_id
      and exists (
        select 1
        from public.venue_unavailability_slot us
        join public.venue_unavailability u
          on u.venue_unavailability_id = us.venue_unavailability_id
        where us.venue_id = v_venue_id
          and us.slot_date = mine.slot_date
          and us.slot = mine.slot
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

    -- An expired hold still sits in booking_slot_no_double_booking_uidx; mark
    -- it Released so confirming this booking does not trip the index.
    with expired as (
      update public.booking other
      set status = 'Released',
          updated_at = now()
      where other.venue_id = v_venue_id
        and other.booking_id <> p_booking_id
        and other.status = 'Tentative Hold'
        and not public.booking_holds_slot(other.status, other.hold_expires_at)
        and exists (
          select 1
          from public.booking_slot bs
          join public.booking_slot mine
            on mine.slot_date = bs.slot_date and mine.slot = bs.slot
          where bs.booking_id = other.booking_id
            and mine.booking_id = p_booking_id
        )
      returning other.booking_id
    )
    insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
    select p_staff_user_account_id, 'booking', booking_id, 'release expired hold'
    from expired;

    update public.booking
    set status = 'Confirmed',
        decided_by_user_account_id = p_staff_user_account_id,
        rejection_note = null,
        suggested_alternative_venue_id = null,
        updated_at = now()
    where booking_id = p_booking_id;
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

-- ---------------------------------------------------------------------------
-- 5. Venue search: an expired hold no longer makes a venue busy. booking_slot
--    carries status but not the expiry, so this now reads it from booking.
-- ---------------------------------------------------------------------------
create or replace function public.venue_busy_intervals(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', b.venue_id,
             'starts_at', b.starts_at,
             'ends_at', b.ends_at)
           order by b.venue_id, b.starts_at), '[]'::jsonb)
  from (
    select
      bs.venue_id,
      (bs.slot_date + s.start_time) at time zone 'Asia/Singapore' as starts_at,
      (bs.slot_date + s.end_time)   at time zone 'Asia/Singapore' as ends_at
    from public.booking_slot bs
    join public.booking bk on bk.booking_id = bs.booking_id
    join public.slot s on s.slot_code = bs.slot
    where public.booking_holds_slot(bk.status, bk.hold_expires_at)
    union
    select
      us.venue_id,
      (us.slot_date + s.start_time) at time zone 'Asia/Singapore',
      (us.slot_date + s.end_time)   at time zone 'Asia/Singapore'
    from public.venue_unavailability_slot us
    join public.venue_unavailability u
      on u.venue_unavailability_id = us.venue_unavailability_id
    join public.slot s on s.slot_code = us.slot
    where u.lifted_at is null
  ) b
  where auth.uid() is not null
    -- Half-open: a slot ending exactly when the window starts does not overlap.
    and b.starts_at < p_to
    and b.ends_at > p_from;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants. venue_booked_slots was dropped, so its grants are restated; the
--    others are replaced in place with the same signature, restated to be safe.
-- ---------------------------------------------------------------------------
revoke execute on function public.booking_holds_slot(text, timestamptz) from public, anon;
grant execute on function public.booking_holds_slot(text, timestamptz) to authenticated;

revoke execute on function public.venue_booked_slots(bigint, date[]) from public;
grant execute on function public.venue_booked_slots(bigint, date[]) to anon, authenticated;

revoke execute on function public.coordinator_submit_booking_request(bigint, bigint, bigint, text, jsonb)
  from public;
grant execute on function public.coordinator_submit_booking_request(bigint, bigint, bigint, text, jsonb)
  to anon, authenticated;

revoke execute on function public.venue_staff_decide_booking(bigint, bigint, text, text, bigint)
  from public;
grant execute on function public.venue_staff_decide_booking(bigint, bigint, text, text, bigint)
  to anon, authenticated;

revoke execute on function public.venue_busy_intervals(timestamptz, timestamptz) from public, anon;
grant execute on function public.venue_busy_intervals(timestamptz, timestamptz) to authenticated;

commit;
