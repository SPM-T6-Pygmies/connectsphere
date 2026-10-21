-- SPM-313: flag the bookings a venue block sits over.
--
-- A flag is a review marker beside a booking's status, with a reason. The booking
-- is not cancelled, reverted or otherwise changed. One booking can carry several
-- reasons, so a flag is one row per reason. SPM-105 and SPM-309 add their own reason
-- codes to the same table; SPM-310 and SPM-251 clear rows; SPM-312 refuses to confirm
-- an event while a row of one of its bookings is open; SPM-71 tells the coordinator.
--
--   reason_code   venue-unavailable (this file), venue-attributes (SPM-105),
--                 event-change (SPM-309)
--   source_ref    what caused it: the block's id, the attribute, the accepted field
--   detail        the text the coordinator reads, e.g.
--                 'Maintenance: 2026-11-16 13:00 to 18:00'
--   cleared_*     empty while the flag is open. Clearing keeps the row as history:
--                 coordinator   the coordinator cleared it (SPM-310)
--                 replaced      its booking was replaced by a confirmed re-request (SPM-251)
--                 booking-ended its booking stopped holding its venue (cancelled, released,
--                               rejected, expired); a trigger below closes it, nobody clears it
--
-- A booking is flagged while at least one of its rows is open, and there is at most
-- one open row per booking, reason code and source: saving the same block twice, or
-- editing the same attribute twice, updates that row instead of adding another.
--
-- Recording a block flags the Confirmed bookings and live holds it overlaps, in the
-- same transaction, under the venue's lock, so a booking confirmed a moment earlier
-- is flagged and one confirmed a moment later is refused by the block itself. A
-- Requested booking is not flagged: Venue Staff cannot approve it over the block
-- (CS028). A lifted block never clears a flag; the page is told it was lifted, from the block.
--
-- An overlap is by time: the booking's slot and the block's slot, on the same date at
-- the same venue, share some time (the domain rule in booking-review-flag.ts says the
-- same). Reading times from the slot table means it keeps working whichever grid a
-- booking or a block is on while SPM-276 moves them from AM/PM/Night to 15 minutes.
--
-- A flag ends with its booking. When a booking stops holding its venue (cancelled,
-- released, rejected, or its hold expires) the trigger below closes its open flags as
-- 'booking-ended', so no function that ends a booking has to know flags exist. The two reads
-- also ignore a flag on a booking that no longer holds, which covers a hold that has run
-- out but has not been marked Expired yet.
--
-- The functions below are the only way in or out of the table (row level security
-- is on and has no policies).

begin;

create table public.booking_review_flag (
  booking_review_flag_id     bigint generated always as identity primary key,
  booking_id                 bigint not null references public.booking (booking_id) on delete cascade,
  reason_code                text   not null,
  source_ref                 text   not null,
  detail                     text   not null,
  flagged_at                 timestamptz not null default now(),
  cleared_at                 timestamptz,
  cleared_by_user_account_id bigint references public.user_account (user_account_id) on delete restrict,
  cleared_how                text,
  constraint booking_review_flag_reason_chk
    check (reason_code in ('venue-unavailable', 'venue-attributes', 'event-change')),
  constraint booking_review_flag_cleared_how_chk
    check (cleared_how is null or cleared_how in ('coordinator', 'replaced', 'booking-ended')),
  constraint booking_review_flag_cleared_chk
    check ((cleared_at is null) = (cleared_how is null)
           and (cleared_by_user_account_id is null or cleared_at is not null))
);

create unique index booking_review_flag_open_uidx
  on public.booking_review_flag (booking_id, reason_code, source_ref)
  where cleared_at is null;

create index booking_review_flag_booking_idx on public.booking_review_flag (booking_id);

alter table public.booking_review_flag enable row level security;

-- Day-and-hours text for a list of spans, with spans that run into each other joined:
-- twenty 15-minute slots read `2026-11-16 13:00 to 18:00`, the same as one PM slot.
-- p_spans is an array of {date, start, end}. The domain's `timeSpans` writes the same text.
create or replace function public.merge_time_spans(p_spans jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  with s as (
    select (x ->> 'date')::date as d, (x ->> 'start')::time as st, (x ->> 'end')::time as en
    from jsonb_array_elements(p_spans) x
  ),
  l as (
    select d, st, en,
           max(en) over (partition by d order by st, en rows between unbounded preceding and 1 preceding) as prev_en
    from s
  ),
  r as (
    select d, st, en,
           sum(case when prev_en is not null and st <= prev_en then 0 else 1 end)
             over (partition by d order by st, en) as run
    from l
  ),
  m as (select d, min(st) as st, max(en) as en from r group by d, run)
  select string_agg(
           to_char(d, 'YYYY-MM-DD') || ' ' || to_char(st, 'HH24:MI') || ' to ' || to_char(en, 'HH24:MI'),
           ', ' order by d, st)
  from m
$$;

-- Recording a block: the same function as before, now taking the venue's lock and
-- flagging what the block sits over.
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

-- Lifting a block: as before. Flags stay open: the coordinator decides what happens next
-- (SPM-310, SPM-251). The read below tells the page the block was lifted, from the block.
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
  v_now timestamptz := now();
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
      lifted_at = v_now
  where venue_unavailability_id = p_unavailability_id;
end;
$$;

-- The bookings a block flagged, with who to tell: what the record use case hands back.
create or replace function public.venue_staff_block_flagged_bookings(
  p_staff_user_account_id bigint,
  p_unavailability_id bigint
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
      'event_id', e.event_id,
      'event_name', e.name,
      'coordinator_user_account_id', e.assigned_coordinator_user_account_id,
      'venue_location', v.location,
      'detail', f.detail
    )
    order by b.booking_id
  ), '[]'::jsonb)
  from public.booking_review_flag f
  join public.booking b on b.booking_id = f.booking_id
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  where f.reason_code = 'venue-unavailable'
    and f.source_ref = p_unavailability_id::text
    and f.cleared_at is null
    and public.booking_holds_slot(b.status, b.hold_expires_at)
    and exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        );
$$;

-- The open flags on one of the coordinator's events, a row per reason. An event that
-- is not theirs gives nothing, the same as one that does not exist (#91).
create or replace function public.coordinator_event_flags(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'flag_id', f.booking_review_flag_id,
      'booking_id', b.booking_id,
      'venue_location', v.location,
      'status', b.status,
      'hold_expires_at', b.hold_expires_at,
      'booked_for', (
        select public.merge_time_spans(jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'start', sl.start_time, 'end', sl.end_time)))
        from public.booking_slot bs
        join public.slot sl on sl.slot_code = bs.slot
        where bs.booking_id = b.booking_id
      ),
      'reason_code', f.reason_code,
      'detail', f.detail,
      -- When the block behind a venue-unavailable reason was lifted; null while it is in force.
      'source_lifted_at', (
        select u.lifted_at
        from public.venue_unavailability u
        where f.reason_code = 'venue-unavailable'
          and u.venue_unavailability_id = f.source_ref::bigint
      ),
      'flagged_at', f.flagged_at
    )
    order by b.booking_id, f.flagged_at, f.booking_review_flag_id
  ), '[]'::jsonb)
  from public.booking_review_flag f
  join public.booking b on b.booking_id = f.booking_id
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
    and f.cleared_at is null
    -- A booking that no longer holds its slot (cancelled, released, expired) has nothing
    -- left to review, so its flag is not shown, whatever it still says in the table.
    and public.booking_holds_slot(b.status, b.hold_expires_at);
$$;

-- A flag ends with its booking: when a booking stops holding its venue, its open flags close.
create or replace function public.booking_review_flag_close_ended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.booking_review_flag
  set cleared_at = now(),
      cleared_how = 'booking-ended'
  where booking_id = new.booking_id
    and cleared_at is null;
  return new;
end;
$$;

create trigger booking_review_flag_close_ended_trg
  after update of status on public.booking
  for each row
  when (new.status is distinct from old.status
        and new.status not in ('Confirmed', 'Tentative Hold'))
  execute function public.booking_review_flag_close_ended();

revoke execute on function public.venue_staff_block_flagged_bookings(bigint, bigint) from public;
grant execute on function public.venue_staff_block_flagged_bookings(bigint, bigint) to anon, authenticated;

revoke execute on function public.coordinator_event_flags(bigint, bigint) from public;
grant execute on function public.coordinator_event_flags(bigint, bigint) to anon, authenticated;

commit;
