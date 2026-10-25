-- SPM-321: Venue Staff block a venue for a time of day, not a slot (SPM-276 AC4/AC5).
--
-- 1. Existing blocks move onto the 15-minute codes: AM -> '28'-'47', PM -> '52'-'71',
--    Night -> '76'-'95', the same conversion the opening hours and the bookings had
--    (20261020010000, 20261022010100). A block covers exactly the time it did.
-- 2. Recording a block refuses time the venue is closed (CS078) -- the backstop for the form and
--    the use case, which refuse it first and name the closed time -- and refuses the same block
--    twice (CS079), except Other, whose note is free text nothing reads.
-- 3. The calendar and list reads order by the slot's start time, not by AM/PM/Night. The calendar
--    read gives each day's rows block by block, so a calendar slot lists its reasons in the
--    order the blocks were recorded.
--
-- Whether a booking is blocked needs nothing here: 20261022010000 compares by time through
-- `slots_overlap` in the booking_slot trigger, approve, hold, confirm hold and the affected list,
-- so it holds for blocks on 15-minute codes as it did for blocks on AM, PM and Night.
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
-- 2. Recording refuses closed time and the same block twice.
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

  -- The same block twice (same venue, reason, days and times) is refused: a double click or a stale
  -- page must not stack an identical block. The core checks first; this closes the race. Other is
  -- exempt: its note is free text nothing reads, so Venue Staff may record several alike.
  if p_reason <> 'Other' and exists (
    select 1
    from public.venue_unavailability u
    where u.venue_id = p_venue_id
      and u.lifted_at is null
      and u.reason_category = p_reason
      and array(select s.slot_date::text || '|' || s.slot
                from public.venue_unavailability_slot s
                where s.venue_unavailability_id = u.venue_unavailability_id
                order by 1)
        = array(select (e ->> 'date') || '|' || (e ->> 'slot')
                from jsonb_array_elements(p_slots) e
                order by 1)
  ) then
    raise exception 'That block is already in force.' using errcode = 'CS079';
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
-- 3. Reads ordered by the slot's start time (the calendar read, block by block within a day).
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
           order by s.venue_id, s.slot_date, u.venue_unavailability_id, sl.start_time), '[]'::jsonb)
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

commit;
