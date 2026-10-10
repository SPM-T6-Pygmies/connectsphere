-- SPM-25: the assigned Event Coordinator turns registration on or off for an
-- event and sets the window Attendees can register in.
--
-- `coordinator_set_event_registration` is the write. The core
-- (`chooseRegistrationSettings`) owns the rules -- enabling needs both dates,
-- and the window cannot run backwards; this restates what the database can
-- check for itself -- the event is the caller's, it is not Completed or
-- Cancelled, and the window is the right way round -- under a row lock. Each
-- changed setting is audited with its old and new value (#96) in the same
-- transaction; saving what is already stored changes nothing and writes
-- nothing.
--
-- `coordinator_events` returns `setof public.event`, so the coordinator's reads
-- already carry the three columns. The Attendee side (`attendee_register` and
-- the `event` grants) already refuses an event whose registration is off or
-- outside its window (SPM-79), so nothing there changes.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository:
--   CS067  no such event, or not assigned to this coordinator (#91)
--   CS068  the event is Completed or Cancelled, so its registration is read-only
--   CS069  the settings are invalid: enabled without both dates, or the window
--          opens after it closes
--
-- Same known gap as the other coordinator functions: the coordinator id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.coordinator_set_event_registration(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_enabled boolean,
  p_open_date date,
  p_close_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
begin
  select * into v_event
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update;

  if not found then
    raise exception 'No event % assigned to coordinator %', p_event_id, p_coordinator_user_account_id
      using errcode = 'CS067';
  end if;

  if v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % is %, so its registration is read-only', p_event_id, v_event.status
      using errcode = 'CS068', detail = v_event.status;
  end if;

  if p_enabled is null
    or (p_enabled and (p_open_date is null or p_close_date is null))
    or (p_open_date is not null and p_close_date is not null and p_close_date < p_open_date) then
    raise exception 'Registration for event % needs both dates to be enabled, opening on or before it closes',
      p_event_id
      using errcode = 'CS069';
  end if;

  if v_event.registration_enabled_flag = p_enabled
    and v_event.registration_open_date is not distinct from p_open_date
    and v_event.registration_close_date is not distinct from p_close_date then
    return;
  end if;

  update public.event
  set registration_enabled_flag = p_enabled,
      registration_open_date = p_open_date,
      registration_close_date = p_close_date
  where event_id = p_event_id;

  insert into public.audit_record (
    actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
  )
  select p_coordinator_user_account_id, 'event', p_event_id, changed.field, changed.old_value, changed.new_value
  from (
    values
      ('registration_enabled_flag', v_event.registration_enabled_flag::text, p_enabled::text),
      ('registration_open_date', v_event.registration_open_date::text, p_open_date::text),
      ('registration_close_date', v_event.registration_close_date::text, p_close_date::text)
  ) as changed (field, old_value, new_value)
  where changed.old_value is distinct from changed.new_value;
end;
$$;

revoke execute on function public.coordinator_set_event_registration(bigint, bigint, boolean, date, date)
  from public;
grant execute on function public.coordinator_set_event_registration(bigint, bigint, boolean, date, date)
  to anon, authenticated;

commit;
