-- Event Operations needs a single-record counterpart to
-- operations_event_requests for its request detail route. The explicit id
-- predicate prevents this read from widening into another list endpoint.

begin;

create or replace function public.operations_event_request(
  p_event_request_id bigint
)
returns public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request
  where event_request_id = p_event_request_id;
$$;

revoke execute on function public.operations_event_request(bigint) from public;

-- Authentication/role enforcement is deferred consistently with the other
-- Event Operations RPCs until the application's authorisation model is
-- enforced at the database boundary.
grant execute on function public.operations_event_request(bigint) to anon, authenticated;

commit;
