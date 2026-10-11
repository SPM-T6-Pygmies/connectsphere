-- SPM-61: who is told when a coordinator asks for a venue.
--
--   venue_staff_ids()
--     Every account holding the Venue Staff role -- each gets the notice.
--     Staff are not scoped to particular venues (#66), so this takes none.
--
-- A system read, made on behalf of the coordinator submitting the request,
-- who may not list staff accounts themselves: executable by service_role
-- only, which the app's admin client uses, never by anon or authenticated.

begin;

create or replace function public.venue_staff_ids()
returns table (user_account_id bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select ur.user_account_id
  from public.user_account_role ur
  join public.role r on r.role_id = ur.role_id
  where r.role_name = 'Venue Staff'
  order by ur.user_account_id;
$$;

revoke execute on function public.venue_staff_ids() from public, anon, authenticated;
grant execute on function public.venue_staff_ids() to service_role;

commit;
