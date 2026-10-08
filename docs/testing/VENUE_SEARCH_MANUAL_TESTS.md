# Venue Search Manual Tests (SPM-44)

## Overview
Manual browser tests for the Event Coordinator searching the venue catalogue on
**Find a venue** (`/staff/coordinator/venues`), on slot-based timing: a search
asks for a date plus slots (AM 07:00–12:00, PM 13:00–18:00, Night 19:00–24:00,
Singapore time) instead of a start and end time.

SPM-44 AC2 still says "start and end time". Slots replace it, so these cases
check the slot form of the rule.

These cases are registered in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-VSEARCH-001–003 | SPM-44 | AC1 — layout capacity, facilities, accessibility |
| TC-VSEARCH-004, 006, 007, 012 | SPM-44 | AC2 — date and slots |
| TC-VSEARCH-009–011 | SPM-44 | AC1 and AC2 together |

TC-VSEARCH-005 (outside operating hours) and TC-VSEARCH-008 (backwards time
window) are retired: they tested inputs that no longer exist.

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack: `supabase db reset` (applies every migration, including
  the `20261006*` slot migrations, and seeds the test accounts)
- UAT data: `supabase db query --file scripts/seed-venue-search-uat/seed.sql --local`
  (`scripts/seed-venue-search-uat/teardown.sql` removes it afterwards)
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `coordinator@test.com` (Event Coordinator)

---

## SPM-44 — Search and filter venues

**Shared Pre-Conditions:** UAT data seeded (see Prerequisites); log in as
`coordinator@test.com` and open **Find a venue** (`/staff/coordinator/venues`).
**D** is 14 days from today, Singapore time, as the seed sets it.

Seeded venues (from `scripts/seed-venue-search-uat/seed.sql`):

| Venue | Slots | Layouts | Facilities / Accessibility | Bookings |
| --- | --- | --- | --- | --- |
| UAT-44 Harbour Room | AM, PM, Night | Theatre 200, Boardroom 20 | Projector, Wi-Fi / Step-free access, Hearing loop | Confirmed on D PM |
| UAT-44 Garden Hall | AM, PM | Banquet 150, Classroom 80 | PA system, Catering area / Lift access | Rejected on D AM |

Both have a 60-day booking horizon; Harbour Room's venue capacity is 250,
Garden Hall's 500.

### TC-VSEARCH-001 Capacity is checked on the searched layout

**Steps**
1. Choose **Room layout** Boardroom, **Attendance** `100`. Click **Search**.
2. Change **Room layout** to Theatre, keep **Attendance** `100`. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed; the summary says 1 venue not shown
      because its Boardroom layout seats fewer than 100.
- [ ] Step 2: Harbour Room is listed.

### TC-VSEARCH-002 No fallback to the venue-wide capacity

**Steps**
1. Leave **Room layout** as Any layout. Enter **Attendance** `300`. Click **Search**.

**Expected Result**
- [ ] No venues found. Garden Hall is not listed although its venue capacity is
      500; the summary says no layout seats 300.

### TC-VSEARCH-003 Every selected facility and accessibility feature is required

**Steps**
1. Tick **Projector** and **Hearing loop**. Click **Search**.
2. Open the page again. Tick **Projector** and **Lift access**. Click **Search**.

**Expected Result**
- [ ] Step 1: only Harbour Room is listed.
- [ ] Step 2: no venues found, since no venue has both; the summary names the
      missing facility and accessibility feature.

### TC-VSEARCH-004 A venue booked in a chosen slot is excluded

**Steps**
1. Enter **Date** D, tick **PM**. Click **Search**.
2. Open the page again. Enter **Date** D, tick **AM**. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed; the summary says it is already booked
      in a slot chosen.
- [ ] Step 2: Harbour Room is listed; the slot before a booked one is free.

### TC-VSEARCH-006 A rejected booking does not block the venue

**Steps**
1. Enter **Date** D, tick **AM**. Click **Search**.

**Expected Result**
- [ ] Garden Hall is listed. Only Tentative Hold and Confirmed bookings make a
      venue busy.

### TC-VSEARCH-007 A date beyond the booking horizon is excluded

**Steps**
1. Enter a **Date** 61 days from today, tick **AM**. Click **Search**.

**Expected Result**
- [ ] No venues found; the summary says they cannot be booked as far ahead as
      the searched date.

### TC-VSEARCH-012 A venue that does not offer a chosen slot is excluded

**Steps**
1. Enter **Date** D, tick **Night**. Click **Search**.
2. Open the page again. Enter **Date** D, tick **AM** and **Night**. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is listed. Garden Hall is not; the summary says it
      does not offer every slot chosen (Night).
- [ ] Step 2: the same. A venue must offer *every* chosen slot, so Garden Hall's
      AM does not let it in.

### TC-VSEARCH-009 Attribute and date filters combine into a candidate list

**Steps**
1. Choose **Room layout** Theatre, **Attendance** `150`; tick **Projector** and
   **Step-free access**; **Date** D, tick **Night**. Click **Search**.

**Expected Result**
- [ ] Only Harbour Room is listed, with its attributes and no pass/fail or
      suitability column (#83).

### TC-VSEARCH-010 Blank filters and an empty result

**Steps**
1. Open **Find a venue** without filling anything.
2. Choose **Room layout** Exhibition. Click **Search**.

**Expected Result**
- [ ] Step 1: every venue in the catalogue is listed, with "N venues found".
- [ ] Step 2: no venues found, with the reason (no Exhibition layout) and a tip
      to widen the search.

### TC-VSEARCH-011 Clear empties every filter

**Steps**
1. Choose Theatre, tick **Wi-Fi** and **Hearing loop**, **Date** D, tick **AM**.
   Click **Search**.
2. Click **Clear**.
3. Choose Banquet, tick **Projector** and **Lift access** without searching.
4. Click **Clear**.

**Expected Result**
- [ ] After steps 2 and 4: date, layout and attendance are blank, no checkbox
      (slot, facility or accessibility) is ticked, and the whole catalogue is
      listed.
