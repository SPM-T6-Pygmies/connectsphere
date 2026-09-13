-- Change of Event Organiser (SPM-39 AC5, #61, #59).
--
-- `organiser_save_event_request` (see
-- 20260910000200_organiser_save_event_request_draft.sql) only ever touches a
-- row that is still `Draft` and owned by the caller -- exactly the two things
-- a reassignment must be able to cross. It needs its own function.
--
-- WHAT THIS DOES NOT DO. It does not check who is allowed to reassign a
-- request, or that the request is in any particular status. No source has
-- settled that authority model yet (tracked separately, SPM-114) -- inventing
-- a rule here would bake in an answer nobody has actually given. Same
-- reasoning, and the same `#62 has not settled auth` caveat, as
-- 20260909000000_organiser_event_request_submission.sql.
--
-- Additive only: no column, constraint or index is altered.

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
