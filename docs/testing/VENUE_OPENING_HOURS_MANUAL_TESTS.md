# Venue Opening Hours Manual Tests (SPM-320)

## Overview

Browser and database checks for **SPM-320 — Set a venue's opening hours in
15-minute periods** (CR-W7-01, parent SPM-276). A venue's opening hours are one
continuous window a day on the 15-minute grid, the same every day, with no break
(team decision on brain Q12, 2026-10-22). They are stored as `venue_slot` rows,
one per open 15-minute slot coded `'0'`–`'95'`, and joined back into a window for
display.

TC-VHOURS-003 (windows may not overlap) is retired: a venue now has one window,
so there is no second one to overlap. TC-VHOURS-008 checks the one-window rule.

The rules are covered by automated tests (`opening-hours.test.ts`,
`time-of-day.test.ts`, `venue.test.ts`, `venue-schema.test.ts`,
`venue-mapper.test.ts`, the SPM-334 block of `booking.test.ts`). These cases
check the pages end to end against Supabase, and the data conversion, which
has no automated harness.

Creating, loading back and editing windows is in
[`VENUE_CATALOGUE_MANUAL_TESTS.md`](VENUE_CATALOGUE_MANUAL_TESTS.md)
(TC-VCAT-001, -002, -004).

These cases are registered in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-VHOURS-001 | SPM-333 | AC1 — the picker stays on the 15-minute grid |
| TC-VHOURS-002 | SPM-332 | AC2 — a window must end after it starts |
| ~~TC-VHOURS-003~~ | SPM-332 | Retired — windows may not overlap |
| TC-VHOURS-004 | SPM-334 | AC3 — a request over closed time is refused |
| TC-VHOURS-005 | SPM-331 | AC4 — AM, PM and Night convert to the slots they cover |
| TC-VHOURS-006 | SPM-335 | AC5 — opening hours show as times |
| TC-VHOURS-007 | SPM-331 | AC4 — every venue's hours become one window |
| TC-VHOURS-008 | SPM-332 | AC2 — a venue opens once a day |

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack: `supabase db reset`, then
  `supabase db query --file scripts/seed-coordinator-view/seed.sql --local` and
  `supabase db query --file scripts/seed-equipment/seed.sql --local`
- Running: `pnpm dev:local`
- TC-VCAT-002 and -004 run first, so **UAT-42 Lecture Hall** exists and is open
  `13:00–24:00`.

### Test Accounts (password `TestPass123!`)
- `venue@test.com` (Venue Staff)
- `coordinator@test.com` (Event Coordinator), owning the approved
  *Founders' Gala Dinner* event

---

## Cases

**Shared Pre-Conditions (001, 002):** log in as `venue@test.com` and open
**UAT-42 Lecture Hall** from the venue catalogue (`/staff/venue/catalogue`).

### TC-VHOURS-001 The picker stays on the 15-minute grid

**Steps**
1. Open the **Opens** hour, **Opens** minute, **Closes** hour and **Closes**
   minute pickers of a window in turn.
2. Set **Closes** to hour `24`, then open its minute picker.

**Expected Result**
- [x] **Opens** offers hours `00`–`23`; **Closes** offers `00`–`24`.
- [x] Both minute pickers offer only `00`, `15`, `30` and `45`.
- [x] Step 2: with hour `24` the minute picker offers only `00`, so `24:00` is
      the latest end and no window crosses midnight.

**Run:** Pass, 20/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`).

### TC-VHOURS-002 A window must end after it starts

**Steps**
1. Set **Closes** to `12`:`00`. Click **Save venue**.
2. Set **Closes** to `13`:`00`. Click **Save venue**.
3. Reload the page.

**Expected Result**
- [ ] Step 1 is refused under the opening hours with "The window 13:00–12:00
      must end after it starts."
- [ ] Step 2 is refused with "The window 13:00–13:00 must end after it starts."
- [ ] Step 3: the venue still opens `13:00` and closes `24:00`; nothing was saved.

Earlier run with two windows: Pass, 20/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`).

### TC-VHOURS-004 A request over closed time is refused

**Pre-Conditions:** log in as `coordinator@test.com`; open *My events* →
*Founders' Gala Dinner* → **Request a venue**; the event has no booking request
yet.

**Steps**
1. Choose **UAT-42 Lecture Hall** (open `13:00–24:00`). On 2026-12-12 request
   `07:00` to `12:00` and click **Send booking request**.
2. Change the times to `12:45` to `13:30` and send.
3. Change the times to `13:00` to `24:00` and send.

**Expected Result**
- [ ] Step 1 is refused with "The venue is closed 2026-12-12 07:00–12:00.
      Choose times within its opening hours or another venue." No request is
      added to *Booking requests for this event*.
- [ ] Step 2 is refused, naming only the closed part: "The venue is closed
      2026-12-12 12:45–13:00."
- [ ] Step 3 is accepted: "Booking request sent for UAT-42 Lecture Hall", and
      the request is listed as **Requested** with 2026-12-12 13:00–24:00.

**Clean up:** `delete from booking where event_id = (select event_id from event where name = 'Founders'' Gala Dinner') and status = 'Requested';`

Earlier run on slots: Pass, 20/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`).

### TC-VHOURS-005 AM, PM and Night convert to the slots they cover

The conversion is the first block of
`supabase/migrations/20261020010000_venue_opening_hours_fifteen_minute_slots.sql`.
Run it against a venue that offered AM and Night, inside a transaction that is
rolled back, so the local data is untouched.

**Steps** — in `psql` on the local database (`docker exec -it supabase_db_connectsphere psql -U postgres`):
1. ```sql
   begin;
   insert into venue (location, capacity, booking_horizon_days) values ('UAT-320 AM and Night', 100, 60);
   insert into venue_slot (venue_id, slot_code)
     select venue_id, c from venue, unnest(array['AM', 'Night']) c where location = 'UAT-320 AM and Night';
   ```
2. Paste the statements under `-- 1. Convert the existing rows.` from the
   migration (the `insert … select` and the `delete`).
3. ```sql
   select count(*), sum(extract(epoch from s.end_time - s.start_time) / 60) as open_minutes,
          count(*) filter (where s.start_time >= '12:00' and s.end_time <= '19:00') as open_12_to_19,
          count(*) filter (where vs.slot_code !~ '^[0-9]+$') as am_pm_night_rows
     from venue_slot vs join slot s using (slot_code) join venue v using (venue_id)
    where v.location = 'UAT-320 AM and Night';
   set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000005"}';
   select r->'opening_hours' from jsonb_array_elements(public.venue_catalogue()) r
    where r->>'location' = 'UAT-320 AM and Night';
   rollback;
   ```
4. On the migrated database: `select count(*) from venue_slot where slot_code !~ '^[0-9]+$';`

**Expected Result**
- [x] Before step 2 the venue has 2 rows, `AM` and `Night`, 600 open minutes.
- [x] After step 2: 40 rows (20 per old slot), still 600 open minutes, none
      between 12:00 and 19:00, and no AM, PM or Night row left.
- [x] The catalogue reads the venue as `07:00–12:00` and `19:00–24:00`.
- [x] Step 4 returns 0: `venue_slot` holds only 15-minute codes.

**Run:** Pass, 20/10/2026, local Supabase, by Claude Code for joyceetran. The
migration's own run on the two converted seed venues also kept their open time
(900 and 600 minutes).

### TC-VHOURS-006 Opening hours show as times

**Steps**
1. As `venue@test.com`, open the venue catalogue (`/staff/venue/catalogue`).
2. As `coordinator@test.com`, open **Find a venue** (`/staff/coordinator/venues`)
   with no filters.
3. Search 2026-12-12, `19:00` to `24:00`.

**Expected Result**
- [ ] Step 1: the column is headed **Opening hours** and lists each venue's
      window as times, e.g. UAT-42 Lecture Hall `13:00–24:00`; a venue with none
      shows `—`. AM, PM and Night appear nowhere on the page.
- [ ] Step 2: the results table has the same **Opening hours** column.
- [ ] Step 3: venues open until 24:00 are listed (UAT-42 Lecture Hall, and
      UAT-44 Harbour Room if `seed-venue-search-uat` is loaded); the rest are
      explained as "closed for part of 19:00–24:00" or "no opening hours or
      booking horizon recorded".

Earlier run on slots and two windows: Pass, 20/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`).
Screenshots, retaken 21/10/2026 on the same build: [step1-catalogue-opening-hours](../screenshots/2026-10-21_SPM-320_TC-VHOURS-006_step1-catalogue-opening-hours.png)

### TC-VHOURS-007 Every venue's hours become one window

SPM-331 AC4, under the one-window rule: each venue opens from its earliest
opening to its latest closing, so neighbouring slots join and a break closes up.
The conversion is `20261020010000` (AM, PM and Night to 15-minute slots) then
`20261023000000` (one window). Run both against one venue of each kind inside a
transaction that is rolled back, so the local data is untouched.

**Steps** — in `psql` on the local database (`docker exec -it supabase_db_connectsphere psql -U postgres`):
1. ```sql
   begin;
   insert into venue (location, capacity, booking_horizon_days)
     select 'UAT-320 ' || k, 100, 60 from unnest(array['AM PM', 'PM Night', 'AM PM Night', 'AM Night', 'AM']) k;
   insert into venue_slot (venue_id, slot_code)
     select venue_id, c from venue, unnest(string_to_array(substr(location, 9), ' ')) c
      where location like 'UAT-320 %';
   ```
2. Paste the statements under `-- 1. Convert the existing rows.` from `20261020010000`
   (the `insert … select` and the `delete`), then the `do $$ … $$;` block from
   `20261023000000`.
3. ```sql
   set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000005"}';
   select r->>'location', r->'opening_hours' from jsonb_array_elements(public.venue_catalogue()) r
    where r->>'location' like 'UAT-320 %' order by 1;
   rollback;
   ```

**Expected Result**
- [ ] Step 2 raises nothing (it checks that no venue is left with a break).
- [ ] Every venue reads one window: **AM PM** `07:00–18:00`, **PM Night**
      `13:00–24:00`, **AM PM Night** `07:00–24:00`, **AM Night** `07:00–24:00`
      and **AM** `07:00–12:00`.

### TC-VHOURS-008 A venue opens once a day

SPM-332 AC2: one opening and one closing time. The form offers only one pair
(TC-VCAT-001); this checks the store refuses a second window from any caller.

**Steps** — in `psql` on the local database:
1. ```sql
   begin;
   select public.venue_catalogue_write_opening_hours(venue_id, '[{"start":"08:00","end":"20:00"}]')
     from venue where location = 'UAT-42 Lecture Hall';
   select min(slot_code::int), max(slot_code::int), count(*) from venue_slot
    where venue_id = (select venue_id from venue where location = 'UAT-42 Lecture Hall');
   select public.venue_catalogue_write_opening_hours(venue_id,
            '[{"start":"07:00","end":"12:00"},{"start":"13:00","end":"18:00"}]')
     from venue where location = 'UAT-42 Lecture Hall';
   rollback;
   ```

**Expected Result**
- [ ] One window saves: slots `32` to `79`, 48 of them (08:00–20:00).
- [ ] Two windows are refused with `CS022` "A venue needs one opening window".
