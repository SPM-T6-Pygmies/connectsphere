-- Reconcile the duplicate 20260912000000 migration version.
--
-- The shared cloud database recorded that version after applying
-- operations_view_all_event_requests, so the identically versioned
-- organiser_reassign_event_request migration was skipped. Repeating this
-- idempotent function definition under a unique version makes every existing
-- environment converge without rewriting its migration history.

begin;

create or replace function public.organiser_reassign_event_request(
  p_event_request_id bigint,
  p_new_responsible_organiser_id bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_request;
begin
  update public.event_request
  set requesting_user_account_id = p_new_responsible_organiser_id
  where event_request_id = p_event_request_id
  returning * into v_row;

  if v_row is null then
    raise exception 'No event request %', p_event_request_id
      using errcode = 'no_data_found';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.organiser_reassign_event_request(bigint, bigint) from public;

grant execute on function public.organiser_reassign_event_request(bigint, bigint)
  to anon, authenticated;

commit;
