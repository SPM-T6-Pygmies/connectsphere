-- Checks that a database matches the Connectsphere Data Single Source of Truth
-- (SPM-277). Read-only. Run it before and after apply.sql.
--
-- Run against a local stack:
--   supabase db query --file scripts/apply-ssot/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true once
-- apply.sql has run. A false row names what differs:
--   * a venue's facilities, accessibility, capacity or layouts-with-seats
--   * the owned count of one of the six equipment types
--   * "extra equipment types": any type outside the six, such as a leftover from a
--     manual test or an item a reservation line still holds (apply.sql keeps those)
--   * a layout a venue has beyond the SSOT (shown in that venue's layouts row)
--
-- The two UAT-44 venues exist only where scripts/seed-venue-search-uat was run.
-- Where they are absent their rows read "not in this database" and count as ok;
-- the four core venues missing is a failure.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not the
-- exit code. The expected values must stay in step with apply.sql.

with venue_ssot (location, capacity, facilities, accessibility, layouts, optional) as (
  values
    ('Main Hall',           '300', 'Wi-Fi, Catering area',      'Step-free access, Hearing loop',
     'Banquet 180, Classroom 150, Theatre 300', false),
    ('Seminar Room 2-1',     '40', 'Wi-Fi, Video-conferencing', 'Lift access',
     'Boardroom 24, Classroom 40', false),
    ('Studio',               '60', 'Wi-Fi, Video-conferencing', 'Step-free access',
     'Theatre 60', false),
    ('Rooftop Terrace',     '150', 'Catering area',             'Lift access',
     'Banquet 120, Exhibition 150', false),
    ('UAT-44 Harbour Room', '250', 'Wi-Fi, Video-conferencing', 'Step-free access, Hearing loop',
     'Boardroom 20, Theatre 200', true),
    ('UAT-44 Garden Hall',  '500', 'Catering area',             'Lift access',
     'Banquet 150, Classroom 80', true)
),
equipment_ssot (type, owned) as (
  values ('Projector', 10), ('Wireless microphone', 30), ('PA speaker', 5),
         ('Presentation laptop', 8), ('Livestream kit', 2), ('Crowd barrier', 40)
),
venue_state as (
  select s.location, s.optional,
         count(v.venue_id) as copies,
         max(v.capacity)::text as capacity,
         max(v.facilities) as facilities,
         max(v.accessibility) as accessibility,
         (select string_agg(rl.name || ' ' || sl.capacity, ', ' order by rl.name)
            from public.venue_supported_layout sl
            join public.room_layout rl on rl.room_layout_id = sl.room_layout_id
           where sl.venue_id = max(v.venue_id)) as layouts
  from venue_ssot s
  left join public.venue v on v.location = s.location
  group by s.location, s.optional
),
checks as (
  select 'venue ' || s.location || ' capacity' as check_name, s.capacity as expected,
         case when st.copies = 0 then 'missing' when st.copies > 1 then 'listed ' || st.copies || ' times'
              else coalesce(st.capacity, 'none') end as actual, st.optional, st.copies
  from venue_ssot s join venue_state st using (location)
  union all
  select 'venue ' || s.location || ' facilities', s.facilities,
         case when st.copies = 0 then 'missing' when st.copies > 1 then 'listed ' || st.copies || ' times'
              else coalesce(st.facilities, 'none') end, st.optional, st.copies
  from venue_ssot s join venue_state st using (location)
  union all
  select 'venue ' || s.location || ' accessibility', s.accessibility,
         case when st.copies = 0 then 'missing' when st.copies > 1 then 'listed ' || st.copies || ' times'
              else coalesce(st.accessibility, 'none') end, st.optional, st.copies
  from venue_ssot s join venue_state st using (location)
  union all
  select 'venue ' || s.location || ' layouts', s.layouts,
         case when st.copies = 0 then 'missing' when st.copies > 1 then 'listed ' || st.copies || ' times'
              else coalesce(st.layouts, 'none') end, st.optional, st.copies
  from venue_ssot s join venue_state st using (location)
  union all
  select 'equipment ' || q.type, q.owned || ' owned',
         case when count(i.equipment_item_id) = 0 then 'missing'
              when count(i.equipment_item_id) > 1 then 'listed ' || count(i.equipment_item_id) || ' times'
              else max(i.quantity) || ' owned' end, false, 1
  from equipment_ssot q
  left join public.equipment_item i on i.type = q.type
  group by q.type, q.owned
  union all
  select 'extra equipment types', 'none',
         coalesce((select string_agg(distinct i.type, ', ' order by i.type)
                     from public.equipment_item i
                    where i.type not in (select type from equipment_ssot)), 'none'), false, 1
)
select check_name, expected,
       case when optional and copies = 0 then 'not in this database' else actual end as actual,
       (actual = expected) or (optional and copies = 0) as ok
from checks
order by ok, check_name;
