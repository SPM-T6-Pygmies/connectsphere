-- SPM-105: flag the bookings a venue edit no longer fits.
--
-- When Venue Staff save a venue, the app judges each Confirmed booking and live hold
-- there with the SPM-45 suitability check, against the venue as it was and as it is
-- now (the rule is the domain's, venue-change-flag.ts). These two functions are its way
-- in and out: one reads the bookings with their events' needs, one writes the reasons
-- to booking_review_flag (SPM-313) as `venue-attributes`, one open row per booking and
-- source, where the source names the check: `capacity:Banquet`, `layout:Banquet`,
-- `accessibility` or `facilities`.
--
-- A reason that starts failing is added, or replaces the open row for the same source
-- (editing the same layout twice keeps one reason, restated). A reason that already
-- failed and now fails differently only restates an open row: one the coordinator
-- cleared (SPM-310) stays cleared. The booking's status is never touched.
--
-- Both run as the caller and check they are Venue Staff, as the catalogue functions do.

begin;

-- The Confirmed bookings and live holds at a venue, with their slots, layout and the
-- event's needs as they are now.
create or replace function public.venue_change_bookings(p_venue_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  perform public.venue_catalogue_require_staff();

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'booking_id', b.booking_id,
        'status', b.status,
        'hold_expires_at', b.hold_expires_at,
        'room_layout_name', rl.name,
        'slots', (
          select coalesce(jsonb_agg(jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                                    order by bs.slot_date, bs.slot), '[]'::jsonb)
          from public.booking_slot bs
          where bs.booking_id = b.booking_id
        ),
        'expected_attendance', e.expected_attendance,
        'room_layout_preference', e.room_layout_preference,
        'accessibility_requirements', e.accessibility_requirements,
        'required_facilities', e.required_facilities
      )
      order by b.booking_id
    ), '[]'::jsonb)
    from public.booking b
    join public.event e on e.event_id = b.event_id
    left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
    where b.venue_id = p_venue_id
      and public.booking_holds_slot(b.status, b.hold_expires_at)
  );
end;
$$;

-- p_flags is an array of {booking_id, source_ref, detail, starts_failing}.
create or replace function public.venue_change_flag_bookings(p_venue_id bigint, p_flags jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.venue_catalogue_require_staff();

  -- Only a booking at this venue that still holds it; one that ended since the read is
  -- skipped. One statement, so the update does not see the rows the insert adds.
  with input as (
    select (x ->> 'booking_id')::bigint as booking_id,
           x ->> 'source_ref' as source_ref,
           x ->> 'detail' as detail,
           (x ->> 'starts_failing')::boolean as starts_failing
    from jsonb_array_elements(p_flags) x
    join public.booking b on b.booking_id = (x ->> 'booking_id')::bigint
    where b.venue_id = p_venue_id
      and public.booking_holds_slot(b.status, b.hold_expires_at)
  ),
  added as (
    insert into public.booking_review_flag (booking_id, reason_code, source_ref, detail)
    select booking_id, 'venue-attributes', source_ref, detail
    from input
    where starts_failing
    on conflict (booking_id, reason_code, source_ref) where cleared_at is null
      do update set detail = excluded.detail, flagged_at = now()
    returning 1
  )
  update public.booking_review_flag f
  set detail = i.detail,
      flagged_at = now()
  from input i
  where not i.starts_failing
    and f.booking_id = i.booking_id
    and f.reason_code = 'venue-attributes'
    and f.source_ref = i.source_ref
    and f.cleared_at is null;
end;
$$;

revoke execute on function public.venue_change_bookings(bigint) from public, anon;
grant execute on function public.venue_change_bookings(bigint) to authenticated;

revoke execute on function public.venue_change_flag_bookings(bigint, jsonb) from public, anon;
grant execute on function public.venue_change_flag_bookings(bigint, jsonb) to authenticated;

commit;
