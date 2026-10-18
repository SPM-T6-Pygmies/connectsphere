-- SPM-264: an event is confirmed only once its latest safety check is Approved.
--
--   coordinator_confirm_event(p_event_id, p_coordinator_user_account_id)
--     As in 20261004000000, plus one check after readiness: the event's latest
--     safety_check row (newest checked_at, then id, as SPM-261 reads it) must
--     be Approved. No check at all, a rejection, and a rejection resubmitted
--     for a fresh check all refuse. Restates `confirmEvent`'s safety rule
--     (src/core/domain/event-readiness.ts) as the last line of defence (§8.6).
--
--     Recording an outcome and resubmitting both lock the event row first, as
--     this does, so a check cannot change between this read and the update.
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseCoordinatorEventRepository (CS050-CS054 belong to the other safety
-- check functions):
--   CS055  the event's latest safety check is not Approved

begin;

create or replace function public.coordinator_confirm_event(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns public.event
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_blocking_count integer;
  v_latest_outcome text;
begin
  select *
  into v_event
  from public.event
  where event_id = p_event_id
  for update;

  if not found
     or v_event.assigned_coordinator_user_account_id
        is distinct from p_coordinator_user_account_id then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
  end if;

  if v_event.status <> 'Planning' then
    raise exception 'Event % with status % cannot be confirmed',
      p_event_id, v_event.status
      using errcode = 'CS021', detail = v_event.status;
  end if;

  -- Restates `assessReadiness` (src/core/domain/event-readiness.ts): only
  -- venue, programme and registration are evaluated. Change both together.
  select count(*)
  into v_blocking_count
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r
  cross join lateral unnest(r.essential_types) as t(arrangement_type)
  where case t.arrangement_type
    when 'venue' then r.confirmed_venue_location is null
    when 'programme' then coalesce(r.programme_agenda, '') !~ '\S'
    when 'registration' then not coalesce(r.registration_enabled, false)
      or r.registration_open_date is null
      or r.registration_close_date is null
    else false
  end;

  if v_blocking_count > 0 then
    raise exception 'Event % still has % incomplete essential arrangement(s)',
      p_event_id, v_blocking_count
      using errcode = 'CS022';
  end if;

  select sc.outcome
  into v_latest_outcome
  from public.safety_check sc
  where sc.event_id = p_event_id
  order by sc.checked_at desc, sc.safety_check_id desc
  limit 1;

  if v_latest_outcome is distinct from 'Approved' then
    raise exception 'Event % has no Approved safety check', p_event_id
      using errcode = 'CS055';
  end if;

  update public.event
  set status = 'Confirmed'
  where event_id = p_event_id
  returning * into v_event;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event', p_event_id, 'confirmed');

  return v_event;
end;
$$;

commit;
