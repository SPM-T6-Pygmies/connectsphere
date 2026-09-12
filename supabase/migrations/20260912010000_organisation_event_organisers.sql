-- List the Event Organisers in a client organisation (SPM-39 AC5).
--
-- Reassignment needs a real list of candidates instead of the demo-only
-- names the UI showed until now. `user_account` and `user_account_role`
-- carry RLS with no policy (same as `event_request`), so this follows the
-- same shape as `organiser_event_requests`: `anon` gets no grant on either
-- table, only on this function, and it can never return a row outside the
-- organisation the caller already named.
--
-- Additive only: no column, constraint or index is altered.

create or replace function public.organisation_event_organisers(
  p_client_organisation_id bigint
)
returns table (user_account_id bigint, name text)
language sql
security definer
set search_path = ''
stable
as $$
  select ua.user_account_id, ua.name
  from public.user_account ua
  join public.user_account_role uar on uar.user_account_id = ua.user_account_id
  join public.role r on r.role_id = uar.role_id
  where ua.client_organisation_id = p_client_organisation_id
    and r.role_name = 'Event Organiser'
  order by ua.name;
$$;

revoke execute on function public.organisation_event_organisers(bigint) from public;

grant execute on function public.organisation_event_organisers(bigint)
  to anon, authenticated;
