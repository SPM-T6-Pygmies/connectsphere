-- SPM: the Event Operations Manager needs one unfiltered source list. The UI
-- owns the assigned/unassigned split, so this function intentionally applies
-- no organisation, status, or coordinator filter.

begin;

create or replace function public.operations_event_requests()
returns setof public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request;
$$;

revoke execute on function public.operations_event_requests() from public;

-- Authentication/role enforcement is explicitly deferred for this increment.
-- Do not carry this anon grant into production without an Operations-role
-- check at the database/server boundary.
grant execute on function public.operations_event_requests() to anon, authenticated;

commit;
