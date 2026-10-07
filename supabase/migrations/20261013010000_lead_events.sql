-- SPM-256: every event, for the Event Coordinator Lead's Coordinators view.
--
--   lead_events(p_user_account_id)
--     Every event row, soonest first, undated last. Facts only -- which of
--     them are active, and whose they are, is `coordinatorWorkloads`' call
--     (src/core/domain/coordinator-workload.ts). Only an account holding the
--     Event Coordinator Lead role may read it.
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseLeadEventRepository (CS050 belongs to the Safety Officer):
--   CS060  the account does not hold the Event Coordinator Lead role
--
-- Known gap, shared with the other staff functions: the reader's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.lead_events(
  p_user_account_id bigint
)
returns setof public.event
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Event Coordinator Lead'
  ) then
    raise exception 'Account % is not an Event Coordinator Lead', p_user_account_id
      using errcode = 'CS060';
  end if;

  return query
  select *
  from public.event e
  order by e.preferred_date nulls last, e.name;
end;
$$;

revoke execute on function public.lead_events(bigint) from public;
grant execute on function public.lead_events(bigint) to anon, authenticated;

commit;
