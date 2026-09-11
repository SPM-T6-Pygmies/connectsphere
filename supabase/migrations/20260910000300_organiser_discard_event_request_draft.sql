-- Discarding a draft event request (SPM-38, not in the original brief but a
-- natural companion to saving one: an Organiser who starts a draft they no
-- longer want should be able to remove it rather than leave it in the list).
--
-- Same shape as `organiser_save_event_request`: `anon` gets no grant on the
-- table, `search_path = ''`, execute revoked from public before being
-- granted, and the `status = 'Draft'` + ownership guard in the `where`
-- clause is the same edit rule `eventRequestAccessFor` draws -- this can
-- never touch a request that has already left Draft, or one some other
-- organiser owns.

create or replace function public.organiser_discard_event_request_draft(
  p_event_request_id           bigint,
  p_requesting_user_account_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.event_request
  where event_request_id = p_event_request_id
    and status = 'Draft'
    and requesting_user_account_id = p_requesting_user_account_id;

  if not found then
    raise exception 'No editable draft % for that organiser', p_event_request_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.organiser_discard_event_request_draft(
  bigint, bigint
) from public;

grant execute on function public.organiser_discard_event_request_draft(
  bigint, bigint
) to anon, authenticated;
