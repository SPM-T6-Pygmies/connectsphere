-- SPM-327 (SPM-276 team decision 6, CR-W7-01): an event request asks for a
-- preferred start and end time on the 15-minute grid.
--
-- 1. event_request_slot keeps its shape. A request's AM, PM and Night rows on
--    its date become one span, from the earliest start to the latest end, as
--    the 15-minute codes it covers: AM + Night is 07:00-24:00, '28' to '95'.
--    A request carries one span, so a gap between its slots is filled in, and
--    each request whose range widened that way is listed in a notice. Drafts
--    convert the same way; a request with no slots keeps none. A check then
--    refuses AM, PM and Night.
-- 2. Submit and save take the preferred start and end time as HH:MM instead
--    of slot codes, and the `preferred_time(event_request)` computed field
--    returns them as {start, end}, as the venue catalogue does for opening
--    hours (SPM-320). The slots stay this file's business.
--
-- coordinator_decide_event_request (SPM-326) needs no change: it maps a
-- 15-minute code to itself when it copies the request's slots to the event.

begin;

do $$
declare
  v_requests        bigint;
  v_rows_expected   bigint;
  v_rows_after      bigint;
  v_widened         record;
begin
  -- One span per request and date, in minutes after midnight.
  create temporary table request_span on commit drop as
  select ers.event_request_id,
         ers.slot_date,
         min(s.start_time) as start_time,
         -- Night ends at 24:00, which `time` holds; read it as 1440 minutes.
         max(extract(epoch from s.end_time)::int / 60) as end_minutes,
         sum(extract(epoch from s.end_time - s.start_time)::int / 60) as slot_minutes
  from public.event_request_slot ers
  join public.slot s on s.slot_code = ers.slot_code
  where ers.slot_code in ('AM', 'PM', 'Night')
  group by ers.event_request_id, ers.slot_date;

  select count(*), coalesce(sum((end_minutes - extract(epoch from start_time)::int / 60) / 15), 0)
  into v_requests, v_rows_expected
  from request_span;

  for v_widened in
    select event_request_id, slot_date, start_time, end_minutes
    from request_span
    where end_minutes - extract(epoch from start_time)::int / 60 > slot_minutes
    order by event_request_id
  loop
    raise notice 'Event request % on % widened to %-%:%',
      v_widened.event_request_id, v_widened.slot_date,
      to_char(v_widened.start_time, 'HH24:MI'),
      lpad((v_widened.end_minutes / 60)::text, 2, '0'),
      lpad((v_widened.end_minutes % 60)::text, 2, '0');
  end loop;

  delete from public.event_request_slot where slot_code in ('AM', 'PM', 'Night');

  insert into public.event_request_slot (event_request_id, slot_date, slot_code)
  select rs.event_request_id, rs.slot_date, n::text
  from request_span rs
  cross join generate_series(
    extract(epoch from rs.start_time)::int / 900,
    rs.end_minutes / 15 - 1
  ) as n;

  select count(*) into v_rows_after
  from public.event_request_slot ers
  join request_span rs using (event_request_id, slot_date);

  -- Every converted request has exactly its span's codes after.
  if v_rows_after <> v_rows_expected then
    raise exception 'Request slot conversion lost rows: % requests, % rows expected, % rows after',
      v_requests, v_rows_expected, v_rows_after;
  end if;
end;
$$;

alter table public.event_request_slot add constraint event_request_slot_fifteen_minute_chk
  check (slot_code ~ '^([0-9]|[1-8][0-9]|9[0-5])$');

-- ---------------------------------------------------------------------------
-- 2. Read: the request's one span, {start, end} as HH:MM, or null with none.
--    Volatile and security definer for the same reasons preferred_slots was
--    (20261006030000_event_request_slots.sql): submit and save write the
--    slots in the statement this is selected on, and event_request_slot has
--    no read policy.
-- ---------------------------------------------------------------------------
drop function public.preferred_slots(public.event_request);

create function public.preferred_time(p_request public.event_request)
returns jsonb
language sql
security definer
set search_path = ''
volatile
as $$
  select case when count(*) = 0 then null
              else jsonb_build_object(
                     'start', to_char(min(s.start_time), 'HH24:MI'),
                     'end', to_char(max(s.end_time), 'HH24:MI'))
         end
  from public.event_request_slot ers
  join public.slot s on s.slot_code = ers.slot_code
  where ers.event_request_id = p_request.event_request_id;
$$;

revoke execute on function public.preferred_time(public.event_request) from public, anon;
grant execute on function public.preferred_time(public.event_request) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Internal helper, not callable through PostgREST: makes the request's
--    slots exactly those from start up to end on its preferred date. The
--    rules are the core's (`submitEventRequest`, `saveEventRequestDraft`);
--    this refuses only what it could not store as one span.
-- ---------------------------------------------------------------------------
drop function public.event_request_write_slots(bigint, date, text[]);

create function public.event_request_write_time(
  p_event_request_id bigint,
  p_preferred_date date,
  p_start time,
  p_end time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.event_request_slot where event_request_id = p_event_request_id;

  if p_start is null and p_end is null then
    return;
  end if;

  if p_preferred_date is null then
    raise exception 'A preferred time needs a preferred date'
      using errcode = 'check_violation';
  end if;

  if p_start is null or p_end is null or p_end <= p_start
     or extract(minute from p_start)::integer % 15 <> 0
     or extract(minute from p_end)::integer % 15 <> 0 then
    raise exception 'The preferred time %-% is not a span on the 15-minute grid',
      p_start, p_end using errcode = 'check_violation';
  end if;

  insert into public.event_request_slot (event_request_id, slot_date, slot_code)
  select p_event_request_id, p_preferred_date, s.slot_code
  from public.slot s
  where s.slot_code ~ '^[0-9]+$'
    and s.start_time >= p_start
    and s.end_time <= p_end;
end;
$$;

revoke execute on function public.event_request_write_time(bigint, date, time, time)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Submit and save take the time. Otherwise unchanged from
--    20261006030000_event_request_slots.sql, grants included.
-- ---------------------------------------------------------------------------
drop function public.organiser_submit_event_request(
  text, text, text, date, text[], integer, text, text, text, text, text, text,
  text, text, bigint, bigint
);

create function public.organiser_submit_event_request(
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_start_time       time,
  p_preferred_end_time         time,
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

  perform public.event_request_write_time(
    v_row.event_request_id, p_preferred_date, p_preferred_start_time, p_preferred_end_time);

  return v_row;
end;
$$;

drop function public.organiser_save_event_request(
  bigint, text, text, text, date, text[], integer, text, text, text, text,
  text, text, text, text, bigint
);

create function public.organiser_save_event_request(
  p_event_request_id           bigint,
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_start_time       time,
  p_preferred_end_time         time,
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

  perform public.event_request_write_time(
    p_event_request_id, p_preferred_date, p_preferred_start_time, p_preferred_end_time);

  return v_row;
end;
$$;

revoke execute on function public.organiser_submit_event_request(
  text, text, text, date, time, time, integer, text, text, text, text, text,
  text, text, text, bigint, bigint
) from public;
grant execute on function public.organiser_submit_event_request(
  text, text, text, date, time, time, integer, text, text, text, text, text,
  text, text, text, bigint, bigint
) to anon, authenticated;

revoke execute on function public.organiser_save_event_request(
  bigint, text, text, text, date, time, time, integer, text, text, text, text,
  text, text, text, text, bigint
) from public;
grant execute on function public.organiser_save_event_request(
  bigint, text, text, text, date, time, time, integer, text, text, text, text,
  text, text, text, text, bigint
) to anon, authenticated;

commit;
