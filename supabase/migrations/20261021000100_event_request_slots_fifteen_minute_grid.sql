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
--
-- Nothing else changes. organiser_submit/save_event_request already write the
-- codes they are given, preferred_slots(event_request) already returns them by
-- start time, and coordinator_decide_event_request (SPM-326) maps a 15-minute
-- code to itself when it copies the request's slots to the new event.

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

commit;
