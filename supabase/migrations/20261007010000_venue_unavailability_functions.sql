-- SPM-21 (SPM-268): record, lift and list venue unavailability blocks, and make
-- a blocked slot count as busy.
--
--   venue_staff_record_unavailability   saves a block and one row per date and slot
--   venue_staff_lift_unavailability     lifts a block that is still In force
--   venue_staff_unavailability          the blocks Venue Staff work from, or one block
--   venue_staff_unavailability_affected the live bookings a block would sit over
--   venue_busy_intervals                now also busy for each In force blocked slot
--
-- Every function checks the caller holds the Venue Staff role, so an account
-- without it reads nothing and changes nothing (#91). Audit rows are written
-- by the triggers from 20261007000000, not here: writing them here too would
-- give two rows per action.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseVenueUnavailabilityRepository:
--   CS036  the caller is not Venue Staff
--   CS037  no such block
--   CS038  the block has already been lifted
--   CS039  the venue is not in the catalogue
-- (CS028 is kept for the booking-slot trigger that refuses a request over a block.)
--
-- Known gap, shared with the other staff functions: the staff id is supplied by
-- the caller and execute is granted to anon, so this trusts the application's
-- acting identity until real authentication lands (#62).

begin;

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

  if not exists (select 1 from public.venue where venue_id = p_venue_id) then
    raise exception 'That venue is not in the catalogue.' using errcode = 'CS039';
  end if;

  insert into public.venue_unavailability
    (venue_id, reason_category, reason_note, recorded_by_user_account_id)
  values (p_venue_id, p_reason, p_note, p_staff_user_account_id)
  returning venue_unavailability_id into v_id;

  insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
  select v_id, (s ->> 'date')::date, s ->> 'slot'
  from jsonb_array_elements(p_slots) s;

  return v_id;
end;
$$;

create or replace function public.venue_staff_lift_unavailability(
  p_staff_user_account_id bigint,
  p_unavailability_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifted_at timestamptz;
begin
  if not exists (
    select 1
    from public.user_account_role uar
    join public.role r on r.role_id = uar.role_id
    where uar.user_account_id = p_staff_user_account_id
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Only Venue Staff can lift a block.' using errcode = 'CS036';
  end if;

  -- Locked, so two staff lifting at once cannot both succeed.
  select lifted_at into v_lifted_at
  from public.venue_unavailability
  where venue_unavailability_id = p_unavailability_id
  for update;

  if not found then
    raise exception 'That block does not exist.' using errcode = 'CS037';
  end if;
  if v_lifted_at is not null then
    raise exception 'That block has already been lifted.' using errcode = 'CS038';
  end if;

  update public.venue_unavailability
  set lifted_by_user_account_id = p_staff_user_account_id,
      lifted_at = now()
  where venue_unavailability_id = p_unavailability_id;
end;
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
                 order by s.slot_date, array_position(array['AM', 'PM', 'Night'], s.slot)
               ), '[]'::jsonb)
        from public.venue_unavailability_slot s
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
    order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot), b.booking_id
  ), '[]'::jsonb)
  from jsonb_array_elements(p_slots) s
  join public.booking_slot bs
    on bs.venue_id = p_venue_id
   and bs.slot_date = (s ->> 'date')::date
   and bs.slot = s ->> 'slot'
  join public.booking b on b.booking_id = bs.booking_id
  join public.event e on e.event_id = b.event_id
  where b.status in ('Requested', 'Tentative Hold', 'Confirmed')
    and exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        );
$$;

-- A venue is busy for a live hold or confirmed booking (as before) and now also
-- for each slot an In force block covers, in the slot's own hours. The return
-- shape and the signature are unchanged, so venue search leaves a blocked venue
-- out with no app change. `union` keeps overlapping blocks from listing the
-- same slot twice.
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
    join public.slot s on s.slot_code = bs.slot
    where bs.status in ('Tentative Hold', 'Confirmed')
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

revoke execute on function public.venue_staff_record_unavailability(bigint, bigint, text, text, jsonb)
  from public;
grant execute on function public.venue_staff_record_unavailability(bigint, bigint, text, text, jsonb)
  to anon, authenticated;
revoke execute on function public.venue_staff_lift_unavailability(bigint, bigint) from public;
grant execute on function public.venue_staff_lift_unavailability(bigint, bigint) to anon, authenticated;
revoke execute on function public.venue_staff_unavailability(bigint, bigint) from public;
grant execute on function public.venue_staff_unavailability(bigint, bigint) to anon, authenticated;
revoke execute on function public.venue_staff_unavailability_affected(bigint, bigint, jsonb) from public;
grant execute on function public.venue_staff_unavailability_affected(bigint, bigint, jsonb)
  to anon, authenticated;

-- Replaced in place with the same signature, so its grants are untouched, but
-- restated to be safe.
revoke execute on function public.venue_busy_intervals(timestamptz, timestamptz) from public, anon;
grant execute on function public.venue_busy_intervals(timestamptz, timestamptz) to authenticated;

commit;
