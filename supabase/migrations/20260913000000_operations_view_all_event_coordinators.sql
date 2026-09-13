-- SPM: the Event Operations Manager needs every user account holding the Event
-- Coordinator role. The role seed assigns Event Coordinator role_id 2, which
-- is the agreed filter for this increment.
--
-- This function deliberately returns a named, credential-free projection
-- rather than `setof user_account`: `credentials_hash` must never leave the
-- database through this read path.

begin;

create or replace function public.operations_event_coordinators()
returns table (
  user_account_id bigint,
  name text,
  contact_details text,
  communication_preferences text,
  department text,
  availability text,
  client_organisation_id bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    account.user_account_id,
    account.name,
    account.contact_details,
    account.communication_preferences,
    account.department,
    account.availability,
    account.client_organisation_id,
    account.created_at,
    account.updated_at
  from public.user_account as account
  inner join public.user_account_role as account_role
    on account_role.user_account_id = account.user_account_id
  where account_role.role_id = 2
  order by account.user_account_id;
$$;

revoke execute on function public.operations_event_coordinators() from public;

-- Authentication/role enforcement remains deferred consistently with the
-- existing Operations event-request read function. Replace this grant with an
-- Event Operations Manager check when the authentication model lands (#62).
grant execute on function public.operations_event_coordinators() to anon, authenticated;

commit;
