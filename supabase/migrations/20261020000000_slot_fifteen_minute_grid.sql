-- SPM-331 (SPM-276 team decision 6, CR-W7-01 D9): the `slot` table becomes
-- the 15-minute grid.
--
-- The day is 96 slots, coded '0' to '95': '0' is 00:00-00:15 and '95' is
-- 23:45-24:00 (24:00 so it stays after its start, as Night already does).
-- Every table that holds slots links to `slot_code`, one row per date per
-- 15-minute slot. AM is slots 28-47, PM 52-71 and Night 76-95.
--
-- Expand step only. The 96 rows sit alongside AM, PM and Night, which every
-- slot table still holds, so nothing that reads slots changes: every read
-- joins on a code it already has. The codes are text, so order slots by
-- `start_time`, never by code ('10' sorts before '2').
--
-- Each SPM-276 story then moves its own table onto the 15-minute codes.
-- SPM-328 deletes the AM, PM and Night rows.

begin;

alter table public.slot drop constraint slot_code_chk;
alter table public.slot add constraint slot_code_chk check (
  slot_code in ('AM', 'PM', 'Night')
  or slot_code ~ '^([0-9]|[1-8][0-9]|9[0-5])$'
);

-- `time` wraps at midnight, so the last slot's end is written as 24:00.
insert into public.slot (slot_code, start_time, end_time)
select n::text,
       time '00:00' + n * interval '15 minutes',
       case when n = 95 then time '24:00'
            else time '00:00' + (n + 1) * interval '15 minutes' end
from generate_series(0, 95) as n;

commit;
