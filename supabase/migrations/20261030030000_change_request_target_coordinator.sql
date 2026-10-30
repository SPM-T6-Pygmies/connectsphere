-- SPM-67: once an Organiser's change request is stored, the event's assigned
-- Coordinator is told what it asks for. The submit already reads
-- organiser_change_request_target, so that read also returns the event's name
-- and its assigned Coordinator -- who to tell, and what to call the event.
--
-- Adding columns changes the function's return type, so it is dropped and
-- recreated with its grants.

begin;

drop function public.organiser_change_request_target(bigint);

-- No access check of its own, matching `organiser_event_request_times`: who
-- may act is the core's call (`changeRequestStateFor`).
create function public.organiser_change_request_target(p_event_request_id bigint)
returns table (
  event_id bigint,
  status text,
  owning_organiser_user_account_id bigint,
  has_open_change_request boolean,
  event_name text,
  assigned_coordinator_user_account_id bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select e.event_id,
         e.status,
         e.owning_organiser_user_account_id,
         exists (
           select 1
           from public.change_request cr
           join public.change_request_item cri on cri.change_request_id = cr.change_request_id
           where cr.event_id = e.event_id
             and cri.decision = 'Pending'
         ),
         e.name,
         e.assigned_coordinator_user_account_id
  from public.event e
  where e.event_request_id = p_event_request_id;
$$;

revoke execute on function public.organiser_change_request_target(bigint) from public;
grant execute on function public.organiser_change_request_target(bigint) to anon, authenticated;

commit;
