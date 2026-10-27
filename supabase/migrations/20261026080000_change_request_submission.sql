-- SPM-52: the event's owning Organiser submits a change request covering one
-- or more significant fields, each with its requested new value (#104).
--
-- 1. change_request becomes a slim header: which event, who asked, when. Every
--    column that described the request as a whole goes (2026-10-18 and
--    2026-10-25 team decisions): there is no significance classification, and
--    change_request_item is the only record of what is asked and decided.
-- 2. change_request_item names one of the five significant fields (#4), once
--    per request. requested_value is the new value as text -- times and
--    registration as JSON, attendance as a number, venue and equipment as free
--    text -- and is null only for "Not applicable", which only equipment and
--    registration may ask for.
-- 3. A request is open while any of its items is Pending. Only one may be open
--    per event; submit_change_request holds that under `for update` on the
--    event, so two concurrent submits cannot both pass the check.
--
-- Like every other table here, both are reached only through `security
-- definer` functions. The submit function restates the core's rules
-- (`assertCanSubmitChangeRequest`) so they hold against any caller.
--
-- Custom SQLSTATEs, translated back into DomainErrors by the adapter:
--   CS090  no event from this request owned by this Organiser (#91: one code
--          for both, so a guess cannot confirm the event exists)
--   CS091  the event is Completed or Cancelled
--   CS092  the event already has an open change request
--   CS093  a change request with no fields

begin;

alter table public.change_request
  drop column requested_change_description,
  drop column significance_flag,
  drop column fields_affected,
  drop column coordinator_decision,
  drop column impact_assessment;

alter table public.change_request_item
  drop column significance_flag,
  add constraint change_request_item_field_chk
    check (field_name in (
      'times', 'venue_requirements', 'expected_attendance',
      'equipment_requirements', 'registration'
    )),
  add constraint change_request_item_not_applicable_chk
    check (requested_value is not null
           or field_name in ('equipment_requirements', 'registration')),
  add constraint change_request_item_field_once
    unique (change_request_id, field_name);

-- ---------------------------------------------------------------------------
-- What the Organiser's page needs to offer a change request
-- ---------------------------------------------------------------------------
-- No access check of its own, matching `organiser_event_request_times`: who
-- may act is the core's call (`changeRequestStateFor`).
create or replace function public.organiser_change_request_target(p_event_request_id bigint)
returns table (
  event_id bigint,
  status text,
  owning_organiser_user_account_id bigint,
  has_open_change_request boolean
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
         )
  from public.event e
  where e.event_request_id = p_event_request_id;
$$;

-- ---------------------------------------------------------------------------
-- Submit (AC1-AC4)
-- ---------------------------------------------------------------------------
-- p_items is a JSON array of {"field_name": ..., "requested_value": ...}.
create or replace function public.submit_change_request(
  p_event_request_id bigint,
  p_requesting_user_account_id bigint,
  p_items jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_change_request_id bigint;
begin
  select * into v_event
  from public.event
  where event_request_id = p_event_request_id
    and owning_organiser_user_account_id = p_requesting_user_account_id
  for update;

  if not found then
    raise exception 'No event from request % owned by user %',
      p_event_request_id, p_requesting_user_account_id
      using errcode = 'CS090';
  end if;

  if v_event.status in ('Completed', 'Cancelled') then
    raise exception 'Event % is % and takes no change requests', v_event.event_id, v_event.status
      using errcode = 'CS091';
  end if;

  if exists (
    select 1
    from public.change_request cr
    join public.change_request_item cri on cri.change_request_id = cr.change_request_id
    where cr.event_id = v_event.event_id
      and cri.decision = 'Pending'
  ) then
    raise exception 'Event % already has an open change request', v_event.event_id
      using errcode = 'CS092';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A change request on event % needs at least one field', v_event.event_id
      using errcode = 'CS093';
  end if;

  insert into public.change_request (event_id, requesting_user_account_id)
  values (v_event.event_id, p_requesting_user_account_id)
  returning change_request_id into v_change_request_id;

  insert into public.change_request_item (change_request_id, field_name, requested_value)
  select v_change_request_id, item ->> 'field_name', item ->> 'requested_value'
  from jsonb_array_elements(p_items) as item;

  return v_change_request_id;
end;
$$;

revoke execute on function public.organiser_change_request_target(bigint) from public;
revoke execute on function public.submit_change_request(bigint, bigint, jsonb) from public;

grant execute on function public.organiser_change_request_target(bigint) to anon, authenticated;
grant execute on function public.submit_change_request(bigint, bigint, jsonb) to anon, authenticated;

commit;
