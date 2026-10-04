-- Slot-based timing: an event request states a preferred date and the slots
-- wanted on it (event_request_slot), instead of a preferred start and end time.
--
-- Submit and save take `p_preferred_slots text[]` in place of
-- `p_preferred_start_time` / `p_preferred_end_time`, so the old signatures are
-- dropped rather than overloaded. Both make the request's slots exactly the
-- list given, on `p_preferred_date`. `preferred_start_time` / `preferred_end_time`
-- are no longer written: a new request has none, a saved draft keeps what it
-- had until the contract migration drops the columns.
--
-- Reads are unchanged: every request function still returns `event_request`
-- rows. `preferred_slots(event_request)` is a PostgREST computed field, so a
-- caller adds it with `select=*,preferred_slots` on the function's result. It
-- is security definer because event_request_slot has no read policy; it only
-- ever sees a row the caller was already handed by one of those functions.

begin;

-- ---------------------------------------------------------------------------
-- 1. Read: the request's slots, in the order the day runs.
--    Volatile, not stable, on purpose: submit and save write the slots inside
--    the same statement whose result this is selected on, and a stable
--    function would read the statement's starting snapshot and miss them.
--    Called directly, it reveals no more than organiser_event_request(id).
-- ---------------------------------------------------------------------------
create or replace function public.preferred_slots(p_request public.event_request)
returns text[]
language sql
security definer
set search_path = ''
volatile
as $$
  select coalesce(array_agg(ers.slot_code order by ers.slot_date, s.start_time), '{}')
  from public.event_request_slot ers
  join public.slot s on s.slot_code = ers.slot_code
  where ers.event_request_id = p_request.event_request_id;
$$;

revoke execute on function public.preferred_slots(public.event_request) from public, anon;
grant execute on function public.preferred_slots(public.event_request) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Internal helper, not callable through PostgREST: makes the request's
--    slots exactly the list given, on its preferred date. A slot cannot be
--    stored without a date; an unknown code fails the foreign key.
-- ---------------------------------------------------------------------------
create or replace function public.event_request_write_slots(
  p_event_request_id bigint,
  p_preferred_date date,
  p_slots text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_slots), 0) > 0 and p_preferred_date is null then
    raise exception 'Preferred slots need a preferred date'
      using errcode = 'check_violation';
  end if;

  delete from public.event_request_slot where event_request_id = p_event_request_id;

  insert into public.event_request_slot (event_request_id, slot_date, slot_code)
  select distinct p_event_request_id, p_preferred_date, code
  from unnest(coalesce(p_slots, '{}')) as code;
end;
$$;

revoke execute on function public.event_request_write_slots(bigint, date, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Submit (insert) and save (update a Draft), now with slots.
-- ---------------------------------------------------------------------------
drop function public.organiser_submit_event_request(
  text, text, text, date, timestamptz, timestamptz, integer, text, text, text,
  text, text, text, text, text, bigint, bigint
);

create function public.organiser_submit_event_request(
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_slots            text[],
  p_expected_attendance        integer,
  p_venue_requirements         text,
  p_room_layout_preferences    text,
  p_accessibility_needs        text,
  p_equipment_requirements     text,
  p_registration_requirements  text,
  p_general_programme          text,
  p_other_special_arrangements text,
  p_status                     text,
  p_requesting_user_account_id bigint,
  p_client_organisation_id     bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_request;
begin
  if p_event_name is null or btrim(p_event_name) = '' then
    raise exception 'An event request needs a name'
      using errcode = 'check_violation';
  end if;

  insert into public.event_request (
    event_name, description, purpose, preferred_date, expected_attendance,
    venue_requirements, room_layout_preferences, accessibility_needs,
    equipment_requirements, registration_requirements, general_programme,
    other_special_arrangements, status, requesting_user_account_id,
    client_organisation_id
  )
  values (
    p_event_name, p_description, p_purpose, p_preferred_date,
    p_expected_attendance, p_venue_requirements, p_room_layout_preferences,
    p_accessibility_needs, p_equipment_requirements,
    p_registration_requirements, p_general_programme,
    p_other_special_arrangements, p_status, p_requesting_user_account_id,
    p_client_organisation_id
  )
  returning * into v_row;

  perform public.event_request_write_slots(
    v_row.event_request_id, p_preferred_date, p_preferred_slots);

  return v_row;
end;
$$;

drop function public.organiser_save_event_request(
  bigint, text, text, text, date, timestamptz, timestamptz, integer, text,
  text, text, text, text, text, text, text, bigint
);

create function public.organiser_save_event_request(
  p_event_request_id           bigint,
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_slots            text[],
  p_expected_attendance        integer,
  p_venue_requirements         text,
  p_room_layout_preferences    text,
  p_accessibility_needs        text,
  p_equipment_requirements     text,
  p_registration_requirements  text,
  p_general_programme          text,
  p_other_special_arrangements text,
  p_status                     text,
  p_requesting_user_account_id bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_request;
begin
  if p_event_name is null or btrim(p_event_name) = '' then
    raise exception 'An event request needs a name'
      using errcode = 'check_violation';
  end if;

  update public.event_request
  set
    event_name                 = p_event_name,
    description                = p_description,
    purpose                    = p_purpose,
    preferred_date             = p_preferred_date,
    expected_attendance        = p_expected_attendance,
    venue_requirements         = p_venue_requirements,
    room_layout_preferences    = p_room_layout_preferences,
    accessibility_needs        = p_accessibility_needs,
    equipment_requirements     = p_equipment_requirements,
    registration_requirements  = p_registration_requirements,
    general_programme          = p_general_programme,
    other_special_arrangements = p_other_special_arrangements,
    status                     = p_status
  where event_request_id = p_event_request_id
    and status = 'Draft'
    and requesting_user_account_id = p_requesting_user_account_id
  returning * into v_row;

  if not found then
    raise exception 'No editable draft % for that organiser', p_event_request_id
      using errcode = 'no_data_found';
  end if;

  perform public.event_request_write_slots(
    p_event_request_id, p_preferred_date, p_preferred_slots);

  return v_row;
end;
$$;

-- The same grants the replaced functions had.
revoke execute on function public.organiser_submit_event_request(
  text, text, text, date, text[], integer, text, text, text, text, text, text,
  text, text, bigint, bigint
) from public;
grant execute on function public.organiser_submit_event_request(
  text, text, text, date, text[], integer, text, text, text, text, text, text,
  text, text, bigint, bigint
) to anon, authenticated;

revoke execute on function public.organiser_save_event_request(
  bigint, text, text, text, date, text[], integer, text, text, text, text,
  text, text, text, text, bigint
) from public;
grant execute on function public.organiser_save_event_request(
  bigint, text, text, text, date, text[], integer, text, text, text, text,
  text, text, text, text, bigint
) to anon, authenticated;

commit;
