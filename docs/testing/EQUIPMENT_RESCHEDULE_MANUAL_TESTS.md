# Equipment Reschedule Manual Tests (SPM-311)

## Overview

Browser checks for **SPM-311: Put reserved equipment under review after a date
change**. When the Coordinator accepts a change request that moves the event to other
dates (SPM-100), every unit its equipment lines hold is released (2026-10-18 team
decision):

- A line that held units goes **Under review** as **Rescheduled**, with nothing
  reserved, and appears on Technical Support's **Needs review** list under the new date
  (AC1, AC2). Technical Support reserve it again, or mark it unfulfilled, through the
  usual SPM-274 choice.
- A line whose removal was requested is simply removed: with its units released there
  is nothing left of it.
- Lines holding nothing (New, Unfulfilled) are left as they are.
- Every Technical Support member is told of each line released.

The hold follows the new date (AC3): the units are free again around the old date, and
a line reserved again is out from the day before the new date to it. A new time on the
same date changes nothing (AC4).

What these cases do **not** cover:

- **An edit back to what was reserved** keeps a Rescheduled line under review, since
  it holds nothing to go back to. It is unit-tested (`rescheduleEquipment`, tagged
  SPM-311) and checked against the database in the PR.
- **Lapsing a Confirmed event's confirmation** (SPM-433, not yet built).

The rules are unit-tested (`rescheduleEquipment`, `DecideChangeRequestUseCase`,
`queueTeaser`, `ListEquipmentQueueUseCase` and the notice wording, all tagged SPM-311).
These cases check the same rules end to end, through the real logins,
`coordinator_decide_change_request`, `reschedule_event_equipment` and the pages.

These cases are registered as `TC-RESCHEDULE-001`–`TC-RESCHEDULE-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them, tick
the boxes below **and** report each in the PR description's `## Manual test results`
table. CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the migrations and the seeded accounts exist, then the
  SPM-273 equipment review seed and this card's seed on top of it:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-equipment-review/seed.sql --local
  supabase db query --file scripts/seed-reschedule-equipment/seed.sql --local
  supabase db query --file scripts/seed-reschedule-equipment/verify.sql --local
  ```
  Every `verify.sql` row should read `ok = true`.
- `pnpm dev:local`
- Use `http://localhost:3000`, not `127.0.0.1` (SPM-285).
- Run the cases in order: each starts where the one before left off. To start again,
  run both `teardown.sql` scripts (this card's first), then both seeds.

### Test accounts (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | Both events' coordinator; deciding their change requests |
| `support@test.com` | Technical Support Staff | Reading the lists and the inbox; reserving again |

### What the seeds set up

| Event | Now | Change request | Lines |
| --- | --- | --- | --- |
| Tech Summit Keynote | 15 Nov, 9:00 am – 12:00 pm | **22 Nov**, 9:00 am – 12:00 pm | Projector 4, **New**, 0 reserved; Wireless microphone 6 (*was 4*), **Changed**, 4 reserved; PA speaker 2, **Removal requested**, 2 reserved |
| Board Strategy Day | 15 Nov, 9:00 am – 12:00 pm | 15 Nov, **2:00 pm – 5:00 pm** | Projector 2 and Wireless microphone 2, both **Reserved** in full |

30 Wireless microphones are owned. Before the change, Board Strategy Day's microphone
line shows Available **24**: Tech Summit Keynote has 4 out on the same days. Tech Summit
Keynote's Projector shows Available **5**, from the other events around 15 Nov.

---

## Test Cases

### TC-RESCHEDULE-001: Accepting a new date releases every held line as Rescheduled (AC1, AC2)

**Steps:**
1. Signed in as `coordinator@test.com`, open *Tech Summit Keynote*'s **Change
   requests** (`/staff/coordinator/events/<id>/change-request`). For **Date and times**
   choose **Accept**.
2. Click **Save decision**.
3. As `support@test.com`, read *Tech Summit Keynote* on the **Needs review** list.
4. Open *Tech Summit Keynote* and read its equipment lines.
5. Open **Notifications**.

**Expected Result:**
- Step 1: the request reads *Date and times · Now 15 Nov 9:00 am – 12:00 pm ·
  Requested 22 Nov 9:00 am – 12:00 pm*.
- Step 2: *No change request is waiting on you.* A *Decided* card shows Date and times
  **Accepted**, 22 Nov 9:00 am – 12:00 pm.
- Step 3: Date **2026-11-22** · *2 lines of 2 need attention, 1 rescheduled*.
- Step 4: the header date is **2026-11-22** and there are two lines:
  - **Projector**: Requested 4 · Reserved 0 · Available **10** · **New**, as before.
  - **Wireless microphone**: Requested 6 (*was 4*) · Reserved **0** · Available 30 ·
    **Rescheduled** with *Reserve again for 2026-11-22* · **Reserve 6**.
  - **PA speaker** is gone.
- Step 5: at the top, *Wireless microphone released on Tech Summit Keynote* (*The
  event's dates changed, so its reservation was released. 6 requested; reserve them
  again for the new date.*) and *PA speaker released on Tech Summit Keynote* (*… Its
  removal was requested, so the line is gone and there is nothing to do.*).

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright

### TC-RESCHEDULE-002: The old date is freed, and the line is reserved again for the new one (AC2, AC3)

**Steps:**
1. As `support@test.com`, open *Board Strategy Day* from **Reviewed** and read
   **Wireless microphone**.
2. Open *Tech Summit Keynote* and click **Reserve 6** on **Wireless microphone**.
3. Read *Tech Summit Keynote* on the **Needs review** list.

**Expected Result:**
- Step 1: Available **28**, where it was 24: the 4 Tech Summit Keynote held on 15 Nov
  are free again.
- Step 2: the row reads Requested **6** · Reserved **6** · Available **24**, with no
  Needs attention mark and *Reserved by Test Support Staff*.
- Step 3: *1 line of 2 needs attention*, with nothing rescheduled.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright

### TC-RESCHEDULE-003: A new time on the same date puts nothing under review (AC4)

**Steps:**
1. As `coordinator@test.com`, open *Board Strategy Day*'s **Change requests**. For
   **Date and times** choose **Accept** and click **Save decision**.
2. As `support@test.com`, read the **Reviewed** list.
3. Open *Board Strategy Day*.
4. Open **Notifications**.

**Expected Result:**
- Step 1: a *Decided* card shows Date and times **Accepted**, 15 Nov 2:00 pm – 5:00 pm.
- Step 2: *Board Strategy Day* is still on **Reviewed**: 2026-11-15 · *2 lines, all
  reserved*.
- Step 3: **Projector** 2 · Reserved 2 and **Wireless microphone** 2 · Reserved 2, both
  *Reserved*, with no Needs attention mark.
- Step 4: nothing new: no notice names *Board Strategy Day*.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright
