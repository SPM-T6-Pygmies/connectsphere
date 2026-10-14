-- SPM-64 and SPM-65: who is told about an event's equipment.
--
--   technical_support_staff_ids()
--     Every account holding the Technical Support Staff role -- each is told
--     when a line needs their attention (SPM-64). Staff are not scoped to
--     particular events (#66), so this takes none.
--
--   event_assigned_coordinator_id(p_event_id)
--     The event's assigned coordinator, or null when it has none or there is
--     no such event -- told when Technical Support finish its equipment
--     (SPM-65).
--
-- System reads, made on behalf of whoever made the change -- a coordinator,
-- or a Technical Support Staff member -- who may not list staff accounts or
-- read another workspace's assignments themselves: executable by
-- service_role only, which the app's admin client uses, never by anon or
-- authenticated.

begin;

create or replace function public.technical_support_staff_ids()
returns table (user_account_id bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select ur.user_account_id
  from public.user_account_role ur
  join public.role r on r.role_id = ur.role_id
  where r.role_name = 'Technical Support Staff'
  order by ur.user_account_id;
$$;

create or replace function public.event_assigned_coordinator_id(p_event_id bigint)
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select e.assigned_coordinator_user_account_id
  from public.event e
  where e.event_id = p_event_id;
$$;

revoke execute on function public.technical_support_staff_ids() from public, anon, authenticated;
grant execute on function public.technical_support_staff_ids() to service_role;

revoke execute on function public.event_assigned_coordinator_id(bigint) from public, anon, authenticated;
grant execute on function public.event_assigned_coordinator_id(bigint) to service_role;

commit;
