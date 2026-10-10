-- SPM-247: the facilities an event needs, recorded by its Event Coordinator so
-- SPM-45 can check a venue against them.
--
-- 1. `event.required_facilities` holds them the way a venue holds its own:
--    facility labels joined by ", ", in the order of the facility list.
--    `coordinator_events` returns `setof public.event`, so the coordinator's
--    reads pick the column up without being redefined.
-- 2. `coordinator_set_event_required_facilities` is the write. The core
--    (`chooseRequiredFacilities`) owns which values are allowed; this restates
--    the two rules the database can check for itself -- the event is the
--    caller's, and it is not Completed or Cancelled -- under a row lock.
--    A change is audited with the old and new value (#96); saving what is
--    already stored changes nothing and writes nothing.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository:
--   CS029  no such event, or not assigned to this coordinator (#91)
--   CS043  the event is Completed or Cancelled, so its facilities are read-only
--
-- Same known gap as the other coordinator functions: the coordinator id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

alter table public.event add column required_facilities text;

create or replace function public.coordinator_set_event_required_facilities(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_facilities text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_old text;
  v_new text := nullif(btrim(p_facilities), '');
begin
  select e.status, e.required_facilities into v_status, v_old
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update;

  if not found then
    raise exception 'No event % assigned to coordinator %', p_event_id, p_coordinator_user_account_id
      using errcode = 'CS029';
  end if;

  if v_status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % is %, so its facilities are read-only', p_event_id, v_status
      using errcode = 'CS043', detail = v_status;
  end if;

  if v_old is not distinct from v_new then
    return;
  end if;

  update public.event
  set required_facilities = v_new
  where event_id = p_event_id;

  insert into public.audit_record (
    actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
  )
  values (
    p_coordinator_user_account_id, 'event', p_event_id,
    'required_facilities', v_old, v_new
  );
end;
$$;

revoke execute on function public.coordinator_set_event_required_facilities(bigint, bigint, text)
  from public;
grant execute on function public.coordinator_set_event_required_facilities(bigint, bigint, text)
  to anon, authenticated;

commit;
