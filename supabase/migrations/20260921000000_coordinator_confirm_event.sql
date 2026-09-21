-- SPT-50: the assigned Event Coordinator confirms an event once every
-- essential arrangement is complete.
--
-- Three functions:
--
--   coordinator_event(p_event_id)
--     A single event row by id, the same single-row-by-id shape as
--     organiser_event_request -- not scoped to a coordinator here; the
--     caller checks assigned_coordinator_user_account_id itself, the same
--     way DecideEventRequestUseCase checks a fetched event_request (#91).
--
--   event_readiness(p_event_id)
--     Only the essential arrangements this ticket can evaluate automatically
--     -- venue, programme, registration. equipment/technical_support/other
--     are excluded: no schema signal decides them yet (SPM-144 tracks
--     deciding essentiality at all; equipment's own completeness is
--     SPM-109's). A venue counts complete if *any* of the event's bookings,
--     or any of its sessions' bookings, is Confirmed -- multi-session
--     aggregation is not a verified rule, just the simplest one that does not
--     block confirmation on an unrelated session's booking.
--
--   coordinator_confirm_event(p_event_id, p_coordinator_user_account_id)
--     Re-checks assignment, status and readiness under a row lock before
--     writing -- the schema's own comment above event_essential_arrangement
--     ("enforced in application/trigger logic ... spans
--     event_essential_arrangement rows") is what this function is. Writes an
--     audit_record row in the same transaction as the status change.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository (CS001-CS004 belong to attendee
-- registration, CS010-CS012 to coordinator_decide_event_request):
--   CS020  no such event, or not assigned to this coordinator (#91)
--   CS021  the event is not in Planning
--   CS022  an essential arrangement is still incomplete -- the adapter calls
--          event_readiness again to name which ones, rather than trying to
--          carry the list through the SQLSTATE
--
-- Known gap, shared with coordinator_decide_event_request: the coordinator id
-- is supplied by the caller and execute is granted to anon, so this trusts
-- the application's acting identity until real authentication lands (#62).

begin;

create or replace function public.coordinator_event(
  p_event_id bigint
)
returns public.event
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event
  where event_id = p_event_id;
$$;

create or replace function public.event_readiness(
  p_event_id bigint
)
returns table (
  arrangement_type text,
  is_complete boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    eea.arrangement_type,
    case eea.arrangement_type
      when 'venue' then exists (
        select 1
        from public.booking b
        where b.status = 'Confirmed'
          and (
            b.event_id = p_event_id
            or b.session_id in (
              select s.session_id from public.session s where s.event_id = p_event_id
            )
          )
      )
      when 'programme' then exists (
        select 1
        from public.event e
        where e.event_id = p_event_id
          and e.programme_agenda is not null
          and btrim(e.programme_agenda) <> ''
      )
      when 'registration' then exists (
        select 1
        from public.event e
        where e.event_id = p_event_id
          and e.registration_enabled_flag
          and e.registration_open_date is not null
          and e.registration_close_date is not null
      )
    end as is_complete
  from public.event_essential_arrangement eea
  where eea.event_id = p_event_id
    and eea.is_essential
    and eea.arrangement_type in ('venue', 'programme', 'registration');
$$;

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
      using errcode = 'CS021';
  end if;

  select count(*)
  into v_blocking_count
  from public.event_readiness(p_event_id)
  where not is_complete;

  if v_blocking_count > 0 then
    raise exception 'Event % still has % incomplete essential arrangement(s)',
      p_event_id, v_blocking_count
      using errcode = 'CS022';
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

revoke execute on function public.coordinator_event(bigint) from public;
revoke execute on function public.event_readiness(bigint) from public;
revoke execute on function public.coordinator_confirm_event(bigint, bigint) from public;

grant execute on function public.coordinator_event(bigint) to anon, authenticated;
grant execute on function public.event_readiness(bigint) to anon, authenticated;
grant execute on function public.coordinator_confirm_event(bigint, bigint) to anon, authenticated;

commit;
