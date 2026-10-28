# Slot Code Retirement Manual Tests (SPM-328)

## Overview

Database checks for **SPM-328 — Retire the AM/PM/Night slot codes** (CR-W7-01,
parent SPM-276). Every slot table moved onto the 15-minute codes `'0'`–`'95'`
in its own story (SPM-320, 321, 324, 326, 327). The contract migration
`supabase/migrations/20261029000000_retire_am_pm_night_slots.sql` then
deletes the AM, PM and Night rows from `slot` and narrows `slot_code_chk` to
`'0'`–`'95'`.

The migration has no automated harness: the unit suite runs on in-memory
fixtures, with no database. `slotCodeRange` refusing `"AM"`, `"PM"` and
`"Night"` is covered in `slot-grid.test.ts`.

These cases are registered in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-SLOTCODE-001 | SPM-361 | SPM-276 AC8 — the AM, PM and Night codes are removed once nothing references them |

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack (`supabase start`). No app is needed.
- Run queries with `supabase db query --local "<sql>"`, or in `psql`
  (`docker exec -it supabase_db_connectsphere psql -U postgres`).

---

## Cases

### TC-SLOTCODE-001 The contract migration on a fresh database and on existing data

**Steps**
1. Fresh database: `supabase db reset`, then
   ```sql
   select count(*), min(start_time), max(end_time),
          count(*) filter (where slot_code in ('AM', 'PM', 'Night')) as old_codes
     from public.slot;
   insert into public.slot values ('AM', '07:00', '12:00');
   insert into public.slot values ('96', '00:00', '00:15');
   ```
2. Existing data: `supabase db reset --version 20261028010000`, then run
   `scripts/seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`,
   `seed-equipment`, `seed-booking-cancel`, `seed-event-cancel` and
   `seed-booking-flags` (each `seed.sql`, with
   `supabase db query --file … --local`). Count the rows:
   ```sql
   select (select count(*) from public.slot) as slot_rows,
          (select count(*) from public.booking_slot) as booking_slots,
          (select count(*) from public.venue_slot) as venue_slots,
          (select count(*) from public.event_slot) as event_slots;
   ```
3. Plant a row still on an old code, then migrate:
   ```sql
   insert into public.venue_slot (venue_id, slot_code) select min(venue_id), 'AM' from public.venue;
   ```
   `supabase migration up --local`
4. `delete from public.venue_slot where slot_code = 'AM';`, then
   `supabase migration up --local` again, and repeat the step 2 count.
5. Run `scripts/seed-booking-cancel/verify.sql`, `scripts/seed-event-cancel/verify.sql`,
   `scripts/seed-venue-unavailability/checks.sql` and
   `scripts/seed-booking-flags/checks.sql`.

**Expected Result**
- [ ] Step 1: the reset applies every migration. `slot` holds 96 rows, `00:00`
      to `24:00`, with no AM, PM or Night. Both inserts are refused by
      `slot_code_chk`.
- [ ] Step 2: `slot` holds 99 rows (the grid plus AM, PM and Night).
- [ ] Step 3: the migration stops with *Cannot retire AM, PM and Night:
      venue_slot still hold them*, and nothing is deleted.
- [ ] Step 4: the migration applies. `slot` holds 96 rows; every other count
      is the same as in step 2.
- [ ] Step 5: every verify row reads `ok = true`; the checks report *all 35
      checks held* and *all 40 checks held*.
