-- SPM-19: approving a booking, or placing a hold on it, is refused when its setup or turnaround
-- time overlaps another live booking's. A booking occupies its booked times plus the venue's
-- setup before and turnaround after (SPM-23); a live booking is a Confirmed one or an unexpired
-- Tentative Hold, and a hold is padded like any other (decided 24 Oct 2026). Windows that only
-- touch do not overlap, and a window past midnight is compared on the next or previous date.
--
-- 1. `booking_padded_windows`: a booking's padded windows, one for each unbroken run of slots on a
--    date. The unique index on (venue, date, slot) sees only the booked slots, so this is where
--    padding is compared.
-- 2. `booking_padded_clashes`: the parts of those windows another live booking at the venue also
--    takes, with that booking's event name, one row per date.
-- 3. `venue_staff_decide_booking` refuses with CS082, the clashes in the error detail as JSON, after
--    its existing checks (a block is CS028, the same booked time is CS025) and inside the venue lock
--    it already takes, so two approvals racing for padded-overlapping times cannot both succeed.
--    Confirming a hold is not re-checked: the hold was checked with its padding when it was placed.

begin;

create function public.booking_padded_windows(p_booking_id bigint)
returns table (window_start timestamp, window_end timestamp)
language sql
stable
security definer
set search_path = ''
as $$
  with venue_padding as (
    select coalesce(ve.setup_time_minutes, 0) as setup,
           coalesce(ve.turnaround_time_minutes, 0) as turnaround
    from public.booking b
    join public.venue ve on ve.venue_id = b.venue_id
    where b.booking_id = p_booking_id
  ),
  booked as (
    select bs.slot_date, sl.start_time, sl.end_time
    from public.booking_slot bs
    join public.slot sl on sl.slot_code = bs.slot
    where bs.booking_id = p_booking_id
  ),
  marked as (
    select slot_date, start_time, end_time,
           case when lag(end_time) over (partition by slot_date order by start_time) = start_time
                then 0 else 1 end as begins_run
    from booked
  ),
  runs as (
    select slot_date, start_time, end_time,
           sum(begins_run) over (partition by slot_date order by start_time) as run_no
    from marked
  )
  select (r.slot_date + min(r.start_time)) - make_interval(mins => p.setup),
         (r.slot_date + max(r.end_time)) + make_interval(mins => p.turnaround)
  from runs r
  cross join venue_padding p
  group by r.slot_date, r.run_no, p.setup, p.turnaround;
$$;

create function public.booking_padded_clashes(p_booking_id bigint)
returns table (event_name text, clash_date date, clash_start time, clash_end time)
language sql
stable
security definer
set search_path = ''
as $$
  with others as (
    select ev.name as event_name, w.window_start, w.window_end
    from public.booking me
    join public.booking o on o.venue_id = me.venue_id and o.booking_id <> me.booking_id
    join public.event ev on ev.event_id = o.event_id
    cross join lateral public.booking_padded_windows(o.booking_id) w
    where me.booking_id = p_booking_id
      and public.booking_holds_slot(o.status, o.hold_expires_at)
  ),
  shared as (
    select o.event_name,
           greatest(m.window_start, o.window_start) as shared_start,
           least(m.window_end, o.window_end) as shared_end
    from public.booking_padded_windows(p_booking_id) m
    join others o on m.window_start < o.window_end and o.window_start < m.window_end
  ),
  per_date as (
    select s.event_name, d::date as day, s.shared_start, s.shared_end
    from shared s
    cross join lateral generate_series(
      s.shared_start::date, (s.shared_end - interval '1 microsecond')::date, interval '1 day') d
  )
  select p.event_name,
         p.day,
         greatest(p.shared_start, p.day::timestamp)::time,
         case when p.shared_end >= (p.day + 1)::timestamp then time '24:00' else p.shared_end::time end
  from per_date p
  order by p.day, 3;
$$;

revoke execute on function public.booking_padded_windows(bigint) from public, anon, authenticated;
revoke execute on function public.booking_padded_clashes(bigint) from public, anon, authenticated;

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
  v_clash text;
  v_blocked text;
  v_padded jsonb;
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

    -- SPM-19: the same booking times padded with the venue's setup before and turnaround
    -- after, against every live booking's padded times. Holds are padded too. A request
    -- whose own times are free can still start setting up while the room is being turned
    -- around for another event.
    select jsonb_agg(
             jsonb_build_object(
               'event', c.event_name,
               'date', c.clash_date,
               'start', to_char(c.clash_start, 'HH24:MI'),
               'end', case when c.clash_end = time '24:00' then '24:00' else to_char(c.clash_end, 'HH24:MI') end)
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

commit;
