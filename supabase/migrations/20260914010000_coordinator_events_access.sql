-- SPM-121's "My events": reading events as the assigned Event Coordinator.
--
-- `event` grants anon/authenticated a narrow column-level select, restricted
-- by RLS to `status = 'Confirmed'` rows (20260907132238_attendee_registration_
-- identity.sql) -- that surface is for the Attendee, and neither the columns
-- (no `assigned_coordinator_user_account_id`, no `client_organisation_id`)
-- nor the row filter fit a coordinator's read. Same shape as
-- coordinator_event_requests: a `security definer` function that identifies
-- exactly what the caller may see, bypassing the Attendee-scoped grant/policy
-- entirely rather than trying to widen it.

create or replace function public.coordinator_events(
  p_coordinator_user_account_id bigint
)
returns setof public.event
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event
  where assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by created_at desc;
$$;

revoke execute on function public.coordinator_events(bigint) from public;
grant execute on function public.coordinator_events(bigint) to anon, authenticated;
