-- SPM-320 AC4 (revised): when AM, PM and Night convert to 15-minute slots,
-- slots that sat next to each other join into one window with no break.
--
-- 20261020010000 converted each slot to the codes it covers and kept the hour
-- between them closed: a venue that offered AM and PM opened 07:00-12:00 and
-- 13:00-18:00. Under the revised AC it opens 07:00-18:00. So:
--
--   AM and PM          gains 12:00-13:00 ('48'-'51')
--   PM and Night       gains 18:00-19:00 ('72'-'75')
--   AM, PM and Night   gains both, and opens 07:00-24:00
--   AM and Night only  is unchanged: PM was not offered, so 12:00-19:00 stays closed
--   one slot only      is unchanged
--
-- A gap is filled only where the conversion left it: both slots either side
-- fully open, and the gap hour fully closed. A venue with any of the gap hour
-- open had its hours set by hand since, and is left as it is. No other open or
-- closed time changes, and the catalogue reads touching slots as one window
-- already, so nothing else needs to change.

begin;

do $$
declare
  v_before bigint;
  v_after  bigint;
begin
  select count(*) into v_before from public.venue_slot;

  with gap (first_open, last_open, gap_from, gap_to) as (
    values
      (28, 71, 48, 51),   -- AM and PM: fill 12:00-13:00
      (52, 95, 72, 75)    -- PM and Night: fill 18:00-19:00
  ),
  joined as (
    select vs.venue_id, g.gap_from, g.gap_to
    from public.venue_slot vs
    cross join gap g
    where vs.slot_code ~ '^[0-9]+$'
    group by vs.venue_id, g.first_open, g.last_open, g.gap_from, g.gap_to
    -- every slot either side of the gap is open, and none of the gap is
    having count(*) filter (
             where vs.slot_code::int between g.first_open and g.last_open
               and vs.slot_code::int not between g.gap_from and g.gap_to) = 40
       and count(*) filter (where vs.slot_code::int between g.gap_from and g.gap_to) = 0
  )
  insert into public.venue_slot (venue_id, slot_code)
  select j.venue_id, n::text
  from joined j
  cross join lateral generate_series(j.gap_from, j.gap_to) n;

  select count(*) into v_after from public.venue_slot;

  -- Each filled gap is one hour: four slots.
  if (v_after - v_before) % 4 <> 0 then
    raise exception 'Joining opening hours added % slots, not whole hours', v_after - v_before;
  end if;
  raise notice 'Joined adjacent opening hours: % slots added', v_after - v_before;
end;
$$;

commit;
