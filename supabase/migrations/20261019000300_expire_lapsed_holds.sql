-- SPM-253: a tentative hold that runs out becomes Expired, not Released.
--
-- `Released` is a person giving a hold up (SPM-219); `Expired` is time running out.
-- Until now a lapsed hold only stopped blocking its slots when read, and the next
-- decision on its slot marked it Released as a stand-in. This adds the real status
-- and replaces the stand-in.
--
-- 1. `booking_status_chk` allows 'Expired'.
-- 2. `expire_lapsed_holds` marks every Tentative Hold at or past its expiry as
--    Expired and writes one audit row, `expire hold`, with no actor: time did it.
--    It is idempotent, so a hold is marked, and audited, exactly once, however many
--    times it is read afterwards. The expiry stays on the row as the true moment it
--    lapsed; the audit row is stamped when it was noticed. There is no scheduler, so
--    callers run it when they read or act: the app before it reads bookings, and the
--    decide function below for its own venue.
--    The sweep with no venue (run before a read) uses `skip locked`, so it never waits
--    on, or deadlocks over, a row another sweep holds. The sweep for one venue (run by
--    a decision, which holds that venue's lock) waits instead: skipping a row would
--    leave a lapsed hold in the slot's unique index and fail the decision.
--    A hold with no expiry counts as live, as `booking_holds_slot` has it.
--    Only signed-in users may call it: it writes, and only ever marks holds that have
--    genuinely lapsed.
-- 3. `venue_staff_decide_booking` calls it for the venue it has locked, in place of
--    the stand-in. It first marks the lapsed hold(s), so the slot's unique index no
--    longer sees them.
-- 4. `venue_staff_bookings` files Expired under Archive, beside Rejected, Released
--    and Cancelled, not under Decided.
-- 5. Two one-off fixes to holds that already exist, so the rules hold for them too:
--    a. holds placed before the cap (SPM-253 AC7) are brought down to their earliest
--       slot's start, so none outlives its slot. One that has already started then
--       lapses on its next read.
--    b. holds the old stand-in marked Released (audit action `release expired hold`)
--       were expired by time, not released by a person, so they become Expired. Their
--       audit rows stay as the record of what happened.

begin;

alter table public.booking drop constraint booking_status_chk;
alter table public.booking add constraint booking_status_chk
  check (status in ('Requested', 'Tentative Hold', 'Confirmed', 'Rejected', 'Released', 'Cancelled', 'Expired'));

create function public.expire_lapsed_holds(p_venue_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  if p_venue_id is null then
    with lapsed as (
      select b.booking_id
      from public.booking b
      where b.status = 'Tentative Hold'
        and b.hold_expires_at is not null
        and b.hold_expires_at <= now()
      order by b.booking_id
      for update skip locked
    ),
    expired as (
      update public.booking b
      set status = 'Expired',
          updated_at = now()
      from lapsed
      where b.booking_id = lapsed.booking_id
      returning b.booking_id
    ),
    audited as (
      insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
      select null, 'booking', booking_id, 'expire hold'
      from expired
      returning 1
    )
    select count(*) into v_expired from audited;
  else
    with lapsed as (
      select b.booking_id
      from public.booking b
      where b.status = 'Tentative Hold'
        and b.hold_expires_at is not null
        and b.hold_expires_at <= now()
        and b.venue_id = p_venue_id
      order by b.booking_id
      for update
    ),
    expired as (
      update public.booking b
      set status = 'Expired',
          updated_at = now()
      from lapsed
      where b.booking_id = lapsed.booking_id
      returning b.booking_id
    ),
    audited as (
      insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
      select null, 'booking', booking_id, 'expire hold'
      from expired
      returning 1
    )
    select count(*) into v_expired from audited;
  end if;

  return v_expired;
end;
$$;

revoke execute on function public.expire_lapsed_holds(bigint) from public;
grant execute on function public.expire_lapsed_holds(bigint) to authenticated;

-- 5a. Bring existing holds down to their earliest slot's start (the cap). The slot
--     table holds each slot's start as Singapore wall-clock time.
update public.booking b
set hold_expires_at = capped.slot_start,
    updated_at = now()
from (
  select bs.booking_id,
         min((bs.slot_date + s.start_time) at time zone 'Asia/Singapore') as slot_start
  from public.booking_slot bs
  join public.slot s on s.slot_code = bs.slot
  group by bs.booking_id
) capped
where b.booking_id = capped.booking_id
  and b.status = 'Tentative Hold'
  and b.hold_expires_at is not null
  and b.hold_expires_at > capped.slot_start;

-- 5b. Holds the old stand-in marked Released were expired by time.
update public.booking b
set status = 'Expired',
    updated_at = now()
where b.status = 'Released'
  and exists (
    select 1
    from public.audit_record a
    where a.entity_type = 'booking'
      and a.entity_id = b.booking_id
      and a.action = 'release expired hold'
  );

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
                 jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                 order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
               ), '[]'::jsonb)
        from public.booking_slot bs
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
                   jsonb_build_object('date', es.slot_date, 'slot', es.slot_code)
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
