-- SPM-20: the assigned Event Coordinator cancels a venue booking.
--
-- The booking becomes Released and its slots are free at once, because
-- booking_slot_no_double_booking_uidx and booking_holds_slot only count a
-- Tentative Hold or Confirmed booking. The venue calendar reads the same rule,
-- so it shows them Available on the next read.
--
-- It restates the core's rule (`cancelBooking`) under the same lock on the
-- venue that a request and a decision take, so a decision landing at the same
-- moment cannot slip past the status check:
--   CS026  no such booking, or not on one of this coordinator's events (#91)
--   CS075  the booking holds nothing any more (new): it was rejected,
--          released, cancelled or expired
--
-- booking_decider_chk wants a decider on anything past Requested. A booking
-- Venue Staff already answered keeps theirs; a pending request nobody decided
-- takes the coordinator's, since cancelling it is the decision that ended it.
-- The audit record names the coordinator either way.
--
-- Any stage of the event will do (AC1). Same known gap as the other
-- coordinator writes: the coordinator id is supplied by the caller and
-- execute is granted to anon, so this trusts the application's acting
-- identity until real authentication lands (#62).

begin;

create function public.coordinator_cancel_booking(
  p_coordinator_user_account_id bigint,
  p_booking_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
begin
  select b.venue_id into v_venue_id
  from public.booking b
  join public.event e on e.event_id = b.event_id
  where b.booking_id = p_booking_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id;

  if v_venue_id is null then
    raise exception 'No booking % on an event assigned to coordinator %',
      p_booking_id, p_coordinator_user_account_id
      using errcode = 'CS026';
  end if;

  perform 1 from public.venue where venue_id = v_venue_id for update;

  select status into v_status from public.booking where booking_id = p_booking_id;

  if v_status not in ('Requested', 'Tentative Hold', 'Confirmed') then
    raise exception 'Booking % is % and holds nothing to cancel', p_booking_id, v_status
      using errcode = 'CS075';
  end if;

  update public.booking
  set status = 'Released',
      decided_by_user_account_id = coalesce(decided_by_user_account_id, p_coordinator_user_account_id),
      updated_at = now()
  where booking_id = p_booking_id;

  insert into public.audit_record (
    actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
  )
  values (
    p_coordinator_user_account_id, 'booking', p_booking_id,
    'status', v_status, 'Released'
  );
end;
$$;

revoke execute on function public.coordinator_cancel_booking(bigint, bigint) from public;
grant execute on function public.coordinator_cancel_booking(bigint, bigint) to anon, authenticated;

commit;
