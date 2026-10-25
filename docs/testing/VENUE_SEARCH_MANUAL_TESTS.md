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
| UAT-44 Harbour Room | 07:00–24:00 | Theatre 200, Boardroom 20 | Wi-Fi, Video-conferencing / Step-free access, Hearing loop | Confirmed on D 13:00–18:00 (PM) |
| UAT-44 Garden Hall | 07:00–18:00 | Banquet 150, Classroom 80 | Catering area / Lift access | Rejected on D 07:00–12:00 (AM) |

The seed writes opening hours as 15-minute slots: Harbour Room once offered AM,
PM and Night, and Garden Hall AM and PM, joined into one window as they convert
(SPM-320 AC4).

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
- [x] Step 1: Harbour Room is not listed; the summary says 1 venue not shown
      because its Boardroom layout seats fewer than 100.
- [x] Step 2: Harbour Room is listed.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Screenshots: [step1-boardroom-100](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-001_step1-boardroom-100.png) · [step2-theatre-100](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-001_step2-theatre-100.png)

### TC-VSEARCH-002 No fallback to the venue-wide capacity

**Steps**
1. Leave **Room layout** as Any layout. Enter **Attendance** `300`. Click **Search**.

**Expected Result**
- [x] No venues found. Garden Hall is not listed although its venue capacity is
      500; the summary says no layout seats 300.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Main Hall, from another local seed, has Theatre 300 and was listed too; the case's check holds: Garden Hall was not listed, and the summary said no layout seats 300. Screenshots: [step1-attendance-300](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-002_step1-attendance-300.png)

### TC-VSEARCH-003 Every selected facility and accessibility feature is required

**Steps**
1. Tick **Video-conferencing** and **Hearing loop**. Click **Search**.
2. Open the page again. Tick **Video-conferencing** and **Lift access**. Click **Search**.

**Expected Result**
- [x] Step 1: only Harbour Room is listed.
- [x] Step 2: no venues found, since no venue has both; the summary names the
      missing facility and accessibility feature.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Step 2 listed Seminar Room 2-1, from another local seed, which has both; neither UAT-44 venue was listed. Screenshots: [step1-video-conferencing-hearing-loop](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-003_step1-video-conferencing-hearing-loop.png) · [step2-video-conferencing-lift-access](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-003_step2-video-conferencing-lift-access.png)

### TC-VSEARCH-006 A rejected booking does not block the venue

**Steps**
1. Enter **Date** D, **Start time** 07:00, **End time** 12:00. Click **Search**.

**Expected Result**
- [x] Garden Hall is listed. Only Tentative Hold and Confirmed bookings make a
      venue busy.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Screenshots: [step1-garden-hall-listed](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-006_step1-garden-hall-listed.png)

### TC-VSEARCH-007 A date beyond the booking horizon is excluded

**Steps**
1. Enter a **Date** 61 days from today, **Start time** 07:00, **End time** 12:00.
   Click **Search**.

**Expected Result**
- [x] Neither UAT-44 venue is listed; the summary says they cannot be booked as
      far ahead as the searched date.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Screenshots: [step1-61-days-ahead](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-007_step1-61-days-ahead.png)

### TC-VSEARCH-009 Attribute and date filters combine into a candidate list

**Steps**
1. Choose **Room layout** Theatre, **Attendance** `150`; tick **Video-conferencing**
   and **Step-free access**; **Date** D, **Start time** 19:00, **End time** 24:00.
   Click **Search**.

**Expected Result**
- [x] Only Harbour Room is listed, with its attributes and no pass/fail or
      suitability column (#83).

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Screenshots: [step1-combined-filters](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-009_step1-combined-filters.png)

### TC-VSEARCH-010 Blank filters and an empty result

**Steps**
1. Open **Find a venue** without filling anything.
2. Choose **Room layout** Exhibition. Click **Search**.

**Expected Result**
- [x] Step 1: every venue in the catalogue is listed, with "N venues found".
- [x] Step 2: no venues found, with the reason (no Exhibition layout) and a tip
      to widen the search ("a different date or time").

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Rooftop Terrace (seed-venues) has Exhibition 150, as the setup warns, so step 2 as written listed it; the alternative Exhibition with attendance 200 gave no venues, the reason and the tip. Screenshots: [step1-blank-filters](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-010_step1-blank-filters.png) · [step2-alt-exhibition-attendance-200](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-010_step2-alt-exhibition-attendance-200.png) · [step2-exhibition-as-written](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-010_step2-exhibition-as-written.png)

### TC-VSEARCH-011 Clear empties every filter

**Steps**
1. Choose Theatre, tick **Wi-Fi** and **Hearing loop**, **Date** D, **Start time**
   07:00, **End time** 12:00. Click **Search**.
2. Click **Clear**.
3. Choose Banquet, tick **Catering area** and **Lift access** without searching.
4. Click **Clear**.

**Expected Result**
- [x] After steps 2 and 4: date, start and end time, layout and attendance are
      blank, no facility or accessibility box is ticked, and the whole catalogue
      is listed.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Screenshots: [step1-filters-set-and-searched](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-011_step1-filters-set-and-searched.png) · [step2-after-clear](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-011_step2-after-clear.png) · [step3-unsearched-filters](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-011_step3-unsearched-filters.png) · [step4-after-clear](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-011_step4-after-clear.png)

---

## SPM-322 — Search venues by start and end time

**Shared Pre-Conditions:** as for SPM-44. Run 013 to 016 in order: 015 adds a
block and lifts it.

### TC-VSEARCH-013 A venue closed for any part of the time is left out (AC1)

**Steps**
1. Enter **Date** D, **Start time** 07:00, **End time** 12:00. Click **Search**.
2. Change the times to 06:45–07:15. Click **Search**.
3. Change the date to D+1 and the times to 17:45–18:15. Click **Search**.

**Expected Result**
- [x] Step 1: both UAT-44 venues are listed. A time that starts as a venue
      opens is open.
- [x] Step 2: neither is listed. The summary counts them as "closed for part of
      06:45–07:15": both open at 07:00.
- [x] Step 3: Garden Hall is not listed, under "closed for part of 17:45–18:15":
      it closes at 18:00. Harbour Room, open until 24:00 and with nothing booked
      on D+1, is listed.

**Run:** Pass, 25/10/2026, Chrome via Claude in Chrome (local, `pnpm dev:local`, after `supabase db reset` with only this seed; D = 2026-11-08), on the one-window build. Screenshots: [step1-07-00-12-00-both-listed](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-013_step1-07-00-12-00-both-listed.jpg) · [step2-06-45-07-15-closed](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-013_step2-06-45-07-15-closed.jpg) · [step3-17-45-18-15-garden-closed](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-013_step3-17-45-18-15-garden-closed.jpg)
Earlier run: Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshots: [step1-07-00-12-00-both-listed](../screenshots/2026-10-22_SPM-320_TC-VSEARCH-013_step1-07-00-12-00-both-listed.png) · [step2-06-45-07-15-closed](../screenshots/2026-10-22_SPM-320_TC-VSEARCH-013_step2-06-45-07-15-closed.png) · [step3-17-45-18-15-garden-closed](../screenshots/2026-10-22_SPM-320_TC-VSEARCH-013_step3-17-45-18-15-garden-closed.png)

### TC-VSEARCH-014 An overlapping booking leaves a venue out; one that only touches does not (AC1, AC2)

**Pre-Conditions:** Harbour Room is open 07:00–24:00 as seeded, so the Confirmed
booking on D 13:00–18:00 has open time on both sides.

**Steps**
1. Enter **Date** D, **Start time** 17:45, **End time** 18:15. Click **Search**.
2. Change the times to 13:15–13:30. Click **Search**.
3. Change the times to 18:00–19:00. Click **Search**.
4. Change the times to 12:00–13:00. Click **Search**.

**Expected Result**
- [x] Step 1: Harbour Room is not listed. The summary counts it as "already
      booked or blocked for part of 17:45–18:15": 15 minutes overlap.
- [x] Step 2: Harbour Room is not listed; a time inside the booking overlaps it.
- [x] Step 3: Harbour Room is listed. The booking ends at 18:00, when this time
      starts.
- [x] Step 4: Harbour Room is listed. The booking starts at 13:00, when this
      time ends.

**Run:** Pass, 25/10/2026, Chrome via Claude in Chrome (local, `pnpm dev:local`, after `supabase db reset` with only this seed; D = 2026-11-08), on the one-window build. Step 1 also left Garden Hall out as closed; step 4 listed both venues. Screenshots: [step1-17-45-18-15-booked](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-014_step1-17-45-18-15-booked.jpg) · [step3-18-00-19-00-touches-end](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-014_step3-18-00-19-00-touches-end.jpg) · [step4-12-00-13-00-touches-start](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-014_step4-12-00-13-00-touches-start.jpg)
Earlier run: Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05), on the seeded 07:00–24:00. Step 4 also listed Garden Hall, now open 12:00–13:00. Screenshot: [step3-18-00-19-00-touches-end](../screenshots/2026-10-22_SPM-320_TC-VSEARCH-014_step3-18-00-19-00-touches-end.png). Earlier run, 21/10/2026, with Harbour Room opened by hand: [step1](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-014_step1-17-45-18-15-overlap.png) · [step4](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-014_step4-12-00-13-00-touches-start.png)

### TC-VSEARCH-015 An In force block leaves a venue out until it is lifted (AC1, AC2)

**Pre-Conditions:** Harbour Room is open 07:00–24:00 as seeded.
As `venue@test.com`, open **Unavailability**, choose **UAT-44 Harbour Room**,
From and To D, Start **19:00**, End **24:00**, Reason **Equipment failure**, and
press **Mark unavailable**.

**Steps**
1. As `coordinator@test.com`, search **Date** D, **Start time** 23:45, **End
   time** 24:00.
2. Search D 18:00–19:00.
3. As `venue@test.com`, press **Lift** on the Harbour Room block. As the
   coordinator, search D 23:45–24:00 again.

**Expected Result**
- [x] Step 1: Harbour Room is not listed, under "already booked or blocked for
      part of 23:45–24:00". The last 15 minutes of the day can be searched.
- [x] Step 2: Harbour Room is listed. The booking ends at 18:00 and the block
      starts at 19:00, and this time touches both.
- [x] Step 3: Harbour Room is listed. A lifted block holds nothing.

**Run:** Pass, 25/10/2026, Chrome via Claude in Chrome (local, `pnpm dev:local`, after `supabase db reset` with only this seed; D = 2026-11-08), on the one-window build, with the block recorded as 19:00–24:00 on the time form. Screenshots: [step1-23-45-24-00-blocked](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-015_step1-23-45-24-00-blocked.jpg) · [step3-lifted](../screenshots/2026-10-25_SPM-320_TC-VSEARCH-015_step3-lifted.jpg)
Earlier run: Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshots: [step1-23-45-24-00-blocked](../screenshots/2026-10-22_SPM-320_TC-VSEARCH-015_step1-23-45-24-00-blocked.png) · [step3-lifted](../screenshots/2026-10-22_SPM-320_TC-VSEARCH-015_step3-lifted.png)

### TC-VSEARCH-016 A time that cannot be searched is refused, naming the problem (AC3)

**Steps**
1. Enter **Date** D only. Click **Search**.
2. Enter **Date** D, **Start time** 14:00, **End time** 13:00. Click **Search**.
3. Enter **Start time** 07:00 and **End time** 08:00 with no date. Click **Search**.
4. Open `/staff/coordinator/venues?date=D&start=07:10&end=09:00`. The picker
   offers only :00, :15, :30 and :45, so an off-grid time arrives by link.
5. Open `/staff/coordinator/venues?date=D&start=24:00&end=24:00`.

**Expected Result**
- [x] Step 1: "Choose a start time." under **Start time**, and no results.
- [x] Step 2: "The end time must be after the start time." under **End time**.
- [x] Step 3: "Choose the event date." under **Date**.
- [x] Step 4: "07:10 is not on the 15-minute grid -- use :00, :15, :30 or :45."
      under **Start time**.
- [x] Step 5: "A search cannot start at 24:00." under **Start time**.
- [x] No step lists any venue or a summary.

**Run:** Pass, 21/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev`, build `1fd160b`). Step 2 was entered through the pickers, which posted `start=14:00&end=13:00`; steps 4 and 5 arrived by link, and the pickers then show 07:00 and a blank hour while the message names 07:10 and 24:00. Screenshots: [step1-date-only](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-016_step1-date-only.png) · [step2-end-before-start](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-016_step2-end-before-start.png) · [step3-no-date](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-016_step3-no-date.png) · [step4-off-grid](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-016_step4-off-grid.png) · [step5-start-24-00](../screenshots/2026-10-21_SPM-322_TC-VSEARCH-016_step5-start-24-00.png)
