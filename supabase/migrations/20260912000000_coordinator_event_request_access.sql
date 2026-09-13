-- SPM-121, SPM-32: reading event requests as the assigned Event Coordinator.
--
-- `event_request` has RLS enabled with no policies (schema.sql), so -- same
-- as the organiser_* functions in
-- 20260909000000_organiser_event_request_submission.sql -- the only way in is
-- a `security definer` function that identifies exactly what the caller may
-- see. `organiser_event_request(bigint)` already serves a single row by id
-- with no organisation check of its own (the organisation/coordinator check
-- happens in the core, via `eventRequestAccessFor`/`eventRequestAccessForCoordinator`),
-- so the coordinator detail view reuses it unchanged; only the list needs a
-- new, coordinator-scoped function.
--
-- Neither `client_organisation.name` nor `user_account.name` is reachable by
-- `anon`/`authenticated` today either (both tables have RLS enabled, no
-- policies -- schema.sql), and the coordinator's two views are the first
-- callers that need a human-readable name rather than a bare id. Two small
-- batched lookups, rather than one row at a time, so a list of N requests
-- costs one round trip instead of N.

create or replace function public.coordinator_event_requests(
  p_coordinator_user_account_id bigint
)
returns setof public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request
  where assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by created_at desc;
$$;

create or replace function public.client_organisation_names(
  p_client_organisation_ids bigint[]
)
returns table (client_organisation_id bigint, name text)
language sql
security definer
set search_path = ''
stable
as $$
  select client_organisation_id, name
  from public.client_organisation
  where client_organisation_id = any (p_client_organisation_ids);
$$;

create or replace function public.user_account_names(
  p_user_account_ids bigint[]
)
returns table (user_account_id bigint, name text)
language sql
security definer
set search_path = ''
stable
as $$
  select user_account_id, name
  from public.user_account
  where user_account_id = any (p_user_account_ids);
$$;

revoke execute on function public.coordinator_event_requests(bigint) from public;
grant execute on function public.coordinator_event_requests(bigint) to anon, authenticated;

revoke execute on function public.client_organisation_names(bigint[]) from public;
grant execute on function public.client_organisation_names(bigint[]) to anon, authenticated;

revoke execute on function public.user_account_names(bigint[]) from public;
grant execute on function public.user_account_names(bigint[]) to anon, authenticated;
