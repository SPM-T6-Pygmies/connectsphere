-- SPT-50: the assigned Event Coordinator confirms an event once every
-- essential arrangement is complete.
--
-- Three functions:
--
--   coordinator_event(p_event_id, p_coordinator_user_account_id)
--     A single event row, only when it is assigned to that coordinator --
--     scoped like its sibling coordinator_events, so the anon key cannot
--     read an arbitrary event by guessing ids. Another coordinator's event
--     and a missing one look the same (#91).
--
--   event_readiness(p_event_id, p_coordinator_user_account_id)
--     Facts only, one row: which arrangement types are essential for the
--     event, where its earliest Confirmed booking is (on the event or any of
--     its sessions), its agenda, and its registration flag and dates. What
--     counts as complete -- and which types are evaluated at all -- is the
--     domain's `assessReadiness` (src/core/domain/event-readiness.ts).
--     Scoped to the assigned coordinator, like coordinator_event; no row
--     otherwise.
--
--   coordinator_confirm_event(p_event_id, p_coordinator_user_account_id)
--     Re-checks assignment, status and readiness under a row lock before
--     writing. The readiness check restates `assessReadiness` in SQL as the
--     last line of defence (§8.6) -- keep the two in sync -- the schema's own comment above event_essential_arrangement
--     ("enforced in application/trigger logic ... spans
--     event_essential_arrangement rows") is what this function is. Writes an
--     audit_record row in the same transaction as the status change.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository (CS001-CS004 belong to attendee
-- registration, CS010-CS012 to coordinator_decide_event_request):
--   CS020  no such event, or not assigned to this coordinator (#91)
--   CS021  the event is not in Planning; DETAIL carries its current status
--   CS022  an essential arrangement is still incomplete -- the adapter calls
--          event_readiness again to name which ones, rather than trying to
--          carry the list through the SQLSTATE
--
-- Known gap, shared with coordinator_decide_event_request: the coordinator id
-- is supplied by the caller and execute is granted to anon, so this trusts
-- the application's acting identity until real authentication lands (#62).

begin;

-- An earlier version of this migration took no coordinator, and its
-- event_readiness returned one row per arrangement.
drop function if exists public.coordinator_event(bigint);
drop function if exists public.event_readiness(bigint);

create or replace function public.coordinator_event(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns public.event
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event
  where event_id = p_event_id
    and assigned_coordinator_user_account_id = p_coordinator_user_account_id;
$$;

create or replace function public.event_readiness(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns table (
  essential_types text[],
  confirmed_venue_location text,
  programme_agenda text,
  registration_enabled boolean,
  registration_open_date date,
  registration_close_date date
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    coalesce(
      array(
        select eea.arrangement_type
        from public.event_essential_arrangement eea
        where eea.event_id = e.event_id
          and eea.is_essential
        order by eea.arrangement_type
      ),
      '{}'
    ),
    (
      select v.location
      from public.booking b
      join public.venue v on v.venue_id = b.venue_id
      where b.status = 'Confirmed'
        and (
          b.event_id = e.event_id
          or b.session_id in (select s.session_id from public.session s where s.event_id = e.event_id)
        )
      order by b.created_at, b.booking_id
      limit 1
    ),
    e.programme_agenda,
    e.registration_enabled_flag,
    e.registration_open_date,
    e.registration_close_date
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id;
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

  update public.event
  set status = 'Confirmed'
  where event_id = p_event_id
  returning * into v_event;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event', p_event_id, 'confirmed');

  return v_event;
end;
$$;

revoke execute on function public.coordinator_event(bigint, bigint) from public;
revoke execute on function public.event_readiness(bigint, bigint) from public;
revoke execute on function public.coordinator_confirm_event(bigint, bigint) from public;

grant execute on function public.coordinator_event(bigint, bigint) to anon, authenticated;
grant execute on function public.event_readiness(bigint, bigint) to anon, authenticated;
grant execute on function public.coordinator_confirm_event(bigint, bigint) to anon, authenticated;

commit;
