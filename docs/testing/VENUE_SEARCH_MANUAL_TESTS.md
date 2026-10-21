# Venue Search Manual Tests (SPM-44, SPM-322)

## Overview
Manual browser tests for the Event Coordinator searching the venue catalogue on
**Find a venue** (`/staff/coordinator/venues`). Since SPM-322 a search asks for
a date with a start and end time on the 15-minute grid, Singapore time. A venue
is left out if it is closed for any part of that time, or if a live booking or
In force block overlaps it. A booking or block that only touches the time does
not.

Bookings and blocks are still stored as AM, PM and Night here (SPM-324 and
SPM-321 move them). The search reads them as the hours they cover: AM
07:00–12:00, PM 13:00–18:00, Night 19:00–24:00.

These cases are registered in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-VSEARCH-001–003 | SPM-44 | AC1 — layout capacity, facilities, accessibility (SPM-322 AC4) |
| TC-VSEARCH-006, 007 | SPM-44 | AC2 — date and time |
| TC-VSEARCH-009–011 | SPM-44 | AC1 and AC2 together (SPM-322 AC4) |
| TC-VSEARCH-013 | SPM-322 | AC1 — closed for any part of the time |
| TC-VSEARCH-014 | SPM-322 | AC1, AC2 — an overlapping booking, and touching times |
| TC-VSEARCH-015 | SPM-322 | AC1, AC2 — an In force block |
| TC-VSEARCH-016 | SPM-322 | AC3 — a time that cannot be searched |

TC-VSEARCH-005 (outside operating hours) and TC-VSEARCH-008 (backwards time
window) are retired: they tested inputs that no longer exist.
TC-VSEARCH-004 (booked in a chosen slot) and TC-VSEARCH-012 (a slot the venue
does not offer) are retired by SPM-322: the search no longer picks slots.
TC-VSEARCH-014 and TC-VSEARCH-013 test the same rules by time.

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

| Venue | Opening hours | Layouts | Facilities / Accessibility | Bookings |
| --- | --- | --- | --- | --- |
| UAT-44 Harbour Room | 07:00–12:00, 13:00–18:00, 19:00–24:00 | Theatre 200, Boardroom 20 | Wi-Fi, Video-conferencing / Step-free access, Hearing loop | Confirmed on D 13:00–18:00 (PM) |
| UAT-44 Garden Hall | 07:00–12:00, 13:00–18:00 | Banquet 150, Classroom 80 | Catering area / Lift access | Rejected on D 07:00–12:00 (AM) |

The seed still writes opening hours as AM, PM and Night; the SPM-320 migration
reads them as the windows above.

Both have a 60-day booking horizon; Harbour Room's venue capacity is 250,
Garden Hall's 500.

**Load only this seed for these cases.** TC-VSEARCH-010 step 2 expects no venue with an
Exhibition layout. Rooftop Terrace in `scripts/seed-venues` now has Exhibition 150 (SPM-277), so
with that seed loaded as well, step 2 lists it.

### TC-VSEARCH-001 Capacity is checked on the searched layout

**Steps**
1. Choose **Room layout** Boardroom, **Attendance** `100`. Click **Search**.
2. Change **Room layout** to Theatre, keep **Attendance** `100`. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed; the summary says 1 venue not shown
      because its Boardroom layout seats fewer than 100.
- [ ] Step 2: Harbour Room is listed.

**Run:** pending (SPM-322 AC4). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-002 No fallback to the venue-wide capacity

**Steps**
1. Leave **Room layout** as Any layout. Enter **Attendance** `300`. Click **Search**.

**Expected Result**
- [ ] No venues found. Garden Hall is not listed although its venue capacity is
      500; the summary says no layout seats 300.

**Run:** pending (SPM-322 AC4). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-003 Every selected facility and accessibility feature is required

**Steps**
1. Tick **Video-conferencing** and **Hearing loop**. Click **Search**.
2. Open the page again. Tick **Video-conferencing** and **Lift access**. Click **Search**.

**Expected Result**
- [ ] Step 1: only Harbour Room is listed.
- [ ] Step 2: no venues found, since no venue has both; the summary names the
      missing facility and accessibility feature.

**Run:** pending (SPM-322 AC4). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-006 A rejected booking does not block the venue

**Steps**
1. Enter **Date** D, **Start time** 07:00, **End time** 12:00. Click **Search**.

**Expected Result**
- [ ] Garden Hall is listed. Only Tentative Hold and Confirmed bookings make a
      venue busy.

**Run:** pending (SPM-322). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-007 A date beyond the booking horizon is excluded

**Steps**
1. Enter a **Date** 61 days from today, **Start time** 07:00, **End time** 12:00.
   Click **Search**.

**Expected Result**
- [ ] Neither UAT-44 venue is listed; the summary says they cannot be booked as
      far ahead as the searched date.

**Run:** pending (SPM-322). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-009 Attribute and date filters combine into a candidate list

**Steps**
1. Choose **Room layout** Theatre, **Attendance** `150`; tick **Video-conferencing**
   and **Step-free access**; **Date** D, **Start time** 19:00, **End time** 24:00.
   Click **Search**.

**Expected Result**
- [ ] Only Harbour Room is listed, with its attributes and no pass/fail or
      suitability column (#83).

**Run:** pending (SPM-322). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-010 Blank filters and an empty result

**Steps**
1. Open **Find a venue** without filling anything.
2. Choose **Room layout** Exhibition. Click **Search**.

**Expected Result**
- [ ] Step 1: every venue in the catalogue is listed, with "N venues found".
- [ ] Step 2: no venues found, with the reason (no Exhibition layout) and a tip
      to widen the search ("a different date or time").

**Run:** pending (SPM-322). The run on the slot form is in `manual-runs.csv`.

### TC-VSEARCH-011 Clear empties every filter

**Steps**
1. Choose Theatre, tick **Wi-Fi** and **Hearing loop**, **Date** D, **Start time**
   07:00, **End time** 12:00. Click **Search**.
2. Click **Clear**.
3. Choose Banquet, tick **Catering area** and **Lift access** without searching.
4. Click **Clear**.

**Expected Result**
- [ ] After steps 2 and 4: date, start and end time, layout and attendance are
      blank, no facility or accessibility box is ticked, and the whole catalogue
      is listed.

**Run:** pending (SPM-322). The run on the slot form is in `manual-runs.csv`.

---

## SPM-322 — Search venues by start and end time

**Shared Pre-Conditions:** as for SPM-44. Run 013 to 016 in order: 014 and 015
change Harbour Room's opening hours and add a block, and 015 puts both back.

### TC-VSEARCH-013 A venue closed for any part of the time is left out (AC1)

**Steps**
1. Enter **Date** D, **Start time** 07:00, **End time** 12:00. Click **Search**.
2. Change the times to 11:45–12:15. Click **Search**.
3. Change the times to 17:00–19:30. Click **Search**.

**Expected Result**
- [ ] Step 1: both UAT-44 venues are listed. A time that matches an opening
      window exactly is open.
- [ ] Step 2: neither is listed. The summary counts them as "closed for part of
      11:45–12:15": both close for lunch at 12:00.
- [ ] Step 3: neither is listed, under "closed for part of 17:00–19:30". Harbour
      Room is also booked 13:00–18:00, but a venue is counted once, under the
      first filter it fails.

**Run:** pending.

### TC-VSEARCH-014 An overlapping booking leaves a venue out; one that only touches does not (AC1, AC2)

**Pre-Conditions:** as `venue@test.com`, open **UAT-44 Harbour Room** in the
venue catalogue (`/staff/venue/catalogue`) and set its opening hours to one
window, **07:00–24:00**. Save. Then sign in as `coordinator@test.com` and open
**Find a venue**. The Confirmed booking on D 13:00–18:00 now has open time on
both sides.

**Steps**
1. Enter **Date** D, **Start time** 17:45, **End time** 18:15. Click **Search**.
2. Change the times to 13:15–13:30. Click **Search**.
3. Change the times to 18:00–19:00. Click **Search**.
4. Change the times to 12:00–13:00. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed. The summary counts it as "already
      booked or blocked for part of 17:45–18:15": 15 minutes overlap.
- [ ] Step 2: Harbour Room is not listed; a time inside the booking overlaps it.
- [ ] Step 3: Harbour Room is listed. The booking ends at 18:00, when this time
      starts.
- [ ] Step 4: Harbour Room is listed. The booking starts at 13:00, when this
      time ends.

**Run:** pending.

### TC-VSEARCH-015 An In force block leaves a venue out until it is lifted (AC1, AC2)

**Pre-Conditions:** TC-VSEARCH-014 has run, so Harbour Room is open 07:00–24:00.
As `venue@test.com`, open **Unavailability**, choose **UAT-44 Harbour Room**,
From and To D, tick **Night**, Reason **Equipment failure**, and press **Mark
unavailable**. The block covers 19:00–24:00.

**Steps**
1. As `coordinator@test.com`, search **Date** D, **Start time** 23:45, **End
   time** 24:00.
2. Search D 18:00–19:00.
3. As `venue@test.com`, press **Lift** on the Harbour Room block. As the
   coordinator, search D 23:45–24:00 again.
4. Clean-up: as `venue@test.com`, set Harbour Room's opening hours back to
   07:00–12:00, 13:00–18:00 and 19:00–24:00.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed, under "already booked or blocked for
      part of 23:45–24:00". The last 15 minutes of the day can be searched.
- [ ] Step 2: Harbour Room is listed. The booking ends at 18:00 and the block
      starts at 19:00, and this time touches both.
- [ ] Step 3: Harbour Room is listed. A lifted block holds nothing.
- [ ] Step 4: the catalogue shows the three windows again.

**Run:** pending.

### TC-VSEARCH-016 A time that cannot be searched is refused, naming the problem (AC3)

**Steps**
1. Enter **Date** D only. Click **Search**.
2. Enter **Date** D, **Start time** 14:00, **End time** 13:00. Click **Search**.
3. Enter **Start time** 07:00 and **End time** 08:00 with no date. Click **Search**.
4. Open `/staff/coordinator/venues?date=D&start=07:10&end=09:00`. The picker
   offers only :00, :15, :30 and :45, so an off-grid time arrives by link.
5. Open `/staff/coordinator/venues?date=D&start=24:00&end=24:00`.

**Expected Result**
- [ ] Step 1: "Choose a start time." under **Start time**, and no results.
- [ ] Step 2: "The end time must be after the start time." under **End time**.
- [ ] Step 3: "Choose the event date." under **Date**.
- [ ] Step 4: "07:10 is not on the 15-minute grid -- use :00, :15, :30 or :45."
      under **Start time**.
- [ ] Step 5: "A search cannot start at 24:00." under **Start time**.
- [ ] No step lists any venue or a summary.

**Run:** pending.
