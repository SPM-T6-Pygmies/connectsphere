-- SPM-320 (team decision on brain Q12, 2026-10-22): a venue opens once a day.
-- Its operating hours are one continuous window, with no break in between.
--
-- 1. Every venue's hours become one window, from its earliest opening to its
--    latest closing. AM and PM (07:00-12:00, 13:00-18:00) open 07:00-18:00;
--    PM and Night 13:00-24:00; AM, PM and Night 07:00-24:00; AM and Night
--    07:00-24:00. A venue that already had one window is unchanged. Hours set
--    by hand with a break close the break the same way. Any AM, PM or Night
--    row left over is read by its hours and replaced by 15-minute slots.
-- 2. venue_catalogue_write_opening_hours refuses more than one window (CS022),
--    restating the core's rule (`defineOpeningHours`) at the store.
--
-- The catalogue still reports opening hours as a list of windows; it now
-- always holds one. Nothing that reads them changes.

begin;

-- ---------------------------------------------------------------------------
-- 1. One window per venue
-- ---------------------------------------------------------------------------
do $$
declare
  v_split bigint;
begin
  with span as (
    select vs.venue_id, min(s.start_time) as opens, max(s.end_time) as closes
    from public.venue_slot vs
    join public.slot s on s.slot_code = vs.slot_code
    group by vs.venue_id
  )
  insert into public.venue_slot (venue_id, slot_code)
  select span.venue_id, g.slot_code
  from span
  join public.slot g
    on g.slot_code ~ '^[0-9]+$'
   and g.start_time >= span.opens
   and g.end_time <= span.closes
  on conflict do nothing;

  delete from public.venue_slot where slot_code !~ '^[0-9]+$';

  -- One window means no missing slot between a venue's first and last.
  select count(*) into v_split
  from (
    select venue_id
    from public.venue_slot
    group by venue_id
    having count(*) <> max(slot_code::int) - min(slot_code::int) + 1
  ) split;
  if v_split > 0 then
    raise exception '% venues still have a break in their opening hours', v_split;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Writes take one window
-- ---------------------------------------------------------------------------
create or replace function public.venue_catalogue_write_opening_hours(
  p_venue_id bigint,
  p_opening_hours jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start time;
  v_end time;
begin
  if p_opening_hours is null
     or jsonb_typeof(p_opening_hours) <> 'array'
     or jsonb_array_length(p_opening_hours) <> 1 then
    raise exception 'A venue needs one opening window' using errcode = 'CS022';
  end if;

  v_start := (p_opening_hours->0->>'start')::time;
  v_end := (p_opening_hours->0->>'end')::time;
  if v_end <= v_start
     or extract(minute from v_start)::integer % 15 <> 0
     or extract(minute from v_end)::integer % 15 <> 0 then
    raise exception 'The opening window %-% is invalid',
      p_opening_hours->0->>'start', p_opening_hours->0->>'end' using errcode = 'CS022';
  end if;

  delete from public.venue_slot where venue_id = p_venue_id;

  insert into public.venue_slot (venue_id, slot_code)
  select p_venue_id, s.slot_code
  from public.slot s
  where s.slot_code ~ '^[0-9]+$'
    and s.start_time >= v_start
    and s.end_time <= v_end;
exception
  when invalid_datetime_format or datetime_field_overflow then
    raise exception 'An opening window time is not HH:MM' using errcode = 'CS022';
end;
$$;

revoke execute on function public.venue_catalogue_write_opening_hours(bigint, jsonb)
  from public, anon, authenticated;

commit;
