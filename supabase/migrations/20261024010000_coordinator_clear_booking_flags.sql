-- SPM-310: the assigned Event Coordinator clears a flag when the booking still fits.
--
-- Clearing closes every open row of the booking in booking_review_flag (SPM-313) as
-- cleared_how = 'coordinator', with who and when. Nothing is deleted: the rows are the
-- record of which reasons were cleared. The booking itself is not touched, and no Venue
-- Staff approval is asked for. It restates the core's rule (`flagsToClear`):
--   CS026  no such booking, or not on one of this coordinator's events (#91), shared
--          with the other coordinator booking writes
--   CS082  the booking has no open flag (new): never flagged, already cleared, or its
--          booking no longer holds its venue
--
-- A flag can come back: the open-row index only covers open rows, so a later block over
-- the booking adds a fresh row as before.
--
-- Same known gap as the other coordinator writes: the coordinator id is supplied by the
-- caller and execute is granted to anon, so this trusts the application's acting identity
-- until real authentication lands (#62).

begin;

create function public.coordinator_clear_booking_flags(
  p_coordinator_user_account_id bigint,
  p_booking_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_hold_expires_at timestamptz;
begin
  select b.status, b.hold_expires_at into v_status, v_hold_expires_at
  from public.booking b
  join public.event e on e.event_id = b.event_id
  where b.booking_id = p_booking_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id;

  if not found then
    raise exception 'No booking % on an event assigned to coordinator %',
      p_booking_id, p_coordinator_user_account_id
      using errcode = 'CS026';
  end if;

  -- A flag on a booking that no longer holds is not shown (coordinator_event_flags), so
  -- there is nothing on the page to clear.
  if not public.booking_holds_slot(v_status, v_hold_expires_at) then
    raise exception 'Booking % is % and has no open flag to clear', p_booking_id, v_status
      using errcode = 'CS082';
  end if;

  update public.booking_review_flag
  set cleared_at = now(),
      cleared_by_user_account_id = p_coordinator_user_account_id,
      cleared_how = 'coordinator'
  where booking_id = p_booking_id
    and cleared_at is null;

  if not found then
    raise exception 'Booking % has no open flag to clear', p_booking_id
      using errcode = 'CS082';
  end if;
end;
$$;

revoke execute on function public.coordinator_clear_booking_flags(bigint, bigint) from public;
grant execute on function public.coordinator_clear_booking_flags(bigint, bigint) to anon, authenticated;

commit;
