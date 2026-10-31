-- SPM-110: once the Coordinator decides a change request, the Organiser who
-- asked for it is told each field's outcome. The Coordinator's read of an
-- event's change requests therefore also returns who asked.
--
-- Adding a column changes the function's return type, so it is dropped and
-- recreated with its grants.

begin;

drop function public.coordinator_event_change_requests(bigint, bigint);

-- Nothing unless the event is assigned to this Coordinator.
create function public.coordinator_event_change_requests(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns table (
  change_request_id bigint,
  created_at timestamptz,
  items jsonb,
  requesting_user_account_id bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select cr.change_request_id,
         cr.created_at,
         (
           select jsonb_agg(
                    jsonb_build_object(
                      'field_name', cri.field_name,
                      'requested_value', cri.requested_value,
                      'decision', cri.decision,
                      'decision_reason', cri.decision_reason
                    )
                    order by cri.change_request_item_id
                  )
           from public.change_request_item cri
           where cri.change_request_id = cr.change_request_id
         ),
         cr.requesting_user_account_id
  from public.change_request cr
  join public.event e on e.event_id = cr.event_id
  where cr.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by cr.created_at desc, cr.change_request_id desc;
$$;

revoke execute on function public.coordinator_event_change_requests(bigint, bigint) from public;
grant execute on function public.coordinator_event_change_requests(bigint, bigint) to anon, authenticated;

commit;
