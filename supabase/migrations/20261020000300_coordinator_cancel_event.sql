-- SPM-55: the assigned Event Coordinator cancels an event, and everything it
-- holds at a venue is given back at once.
--
-- `coordinator_cancel_event` restates the domain's `cancelEvent`
-- (src/core/domain/event-cancellation.ts) under a row lock (§8.6) -- change
-- the two together:
--   - only the assigned coordinator may (AC1);
--   - only a Planning, Blocked or Confirmed event: a Completed one is over and
--     a Cancelled one already is (AC2).
--
-- What happens to each of the event's bookings (AC3, AC4):
--   Confirmed, or a live Tentative Hold   -> Released, through SPM-20's
--                                            coordinator_cancel_booking, so the
--                                            release is written once
--   Tentative Hold already past its expiry -> Expired, through SPM-253's
--                                            expire_lapsed_holds: time ran out,
--                                            nobody released it
--   Requested                             -> Cancelled: it never held a slot,
--                                            so it gave nothing up. Venue Staff
--                                            can no longer approve or hold it,
--                                            because both need it Requested
--   Rejected, Released, Cancelled, Expired -> unchanged; they hold nothing
-- Every one of those frees its slots: booking_holds_slot and the one-per-slot
-- index only count a Confirmed booking or a live hold, and
-- booking_slot_sync_from_booking_trg carries the status onto booking_slot.
--
-- Locks are taken event first, then the event's venues in venue_id order --
-- the same lock a booking request and a decision take on a venue, so neither
-- can change a booking between the reads below and the writes. Equipment needs
-- nothing here (AC5): its availability only counts Planning, Blocked and
-- Confirmed events.
--
-- booking_decider_chk wants a decider on anything past Requested, so a
-- cancelled request records the coordinator, as coordinator_cancel_booking
-- does. Each booking change is audited (status, old -> new) and the event's
-- as action 'cancelled', the way confirming and completing are.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository:
--   CS070  no such event, or not assigned to this coordinator (#91)
--   CS076  the event is Completed or Cancelled (new); DETAIL carries its status
--
-- Same known gap as the other coordinator functions: the coordinator id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create function public.coordinator_cancel_event(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_venue_id bigint;
  v_booking_id bigint;
begin
  select e.status into v_status
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update;

  if not found then
    raise exception 'No event % assigned to coordinator %', p_event_id, p_coordinator_user_account_id
      using errcode = 'CS070';
  end if;

  if v_status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % with status % cannot be cancelled', p_event_id, v_status
      using errcode = 'CS076', detail = v_status;
  end if;

  for v_venue_id in
    select distinct b.venue_id
    from public.booking b
    where b.event_id = p_event_id
      and b.status in ('Requested', 'Tentative Hold', 'Confirmed')
    order by b.venue_id
  loop
    perform 1 from public.venue where venue_id = v_venue_id for update;
    perform public.expire_lapsed_holds(v_venue_id);
  end loop;

  for v_booking_id in
    select b.booking_id
    from public.booking b
    where b.event_id = p_event_id
      and b.status in ('Tentative Hold', 'Confirmed')
    order by b.booking_id
  loop
    perform public.coordinator_cancel_booking(p_coordinator_user_account_id, v_booking_id);
  end loop;

  with cancelled as (
    update public.booking
    set status = 'Cancelled',
        decided_by_user_account_id = p_coordinator_user_account_id,
        updated_at = now()
    where event_id = p_event_id
      and status = 'Requested'
    returning booking_id
  )
  insert into public.audit_record (
    actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
  )
  select p_coordinator_user_account_id, 'booking', booking_id, 'status', 'Requested', 'Cancelled'
  from cancelled;

  update public.event
  set status = 'Cancelled'
  where event_id = p_event_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event', p_event_id, 'cancelled');
end;
$$;

revoke execute on function public.coordinator_cancel_event(bigint, bigint) from public;
grant execute on function public.coordinator_cancel_event(bigint, bigint) to anon, authenticated;

commit;
