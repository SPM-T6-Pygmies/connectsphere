# Equipment Release Manual Tests (SPM-108)

## Overview

Browser checks for **SPM-108: Release equipment on a removal request**. When a
coordinator removes a line that has equipment reserved against it, the line stays,
marked **Removal requested**, with its units still held (SPM-41 AC11). On the event's
page under **Needs review** (`/staff/technical/<event>`), that line now has
**Release N** in the **Decision** column. Releasing asks first, then:

- removes the line from the event, for Technical Support and for the coordinator, and
  takes it off the Needs review count (AC1);
- frees its units at once for other events on those dates (AC2).

If the coordinator undoes the removal before Technical Support act, there is nothing
to release, and Technical Support are told so (AC3). Only Technical Support Staff can
open the page or release (AC4).

What these cases do **not** cover:

- **Reserving a Changed line again**: SPM-316 ([EQUIPMENT_RERESERVE_MANUAL_TESTS.md](EQUIPMENT_RERESERVE_MANUAL_TESTS.md)).
  *Wireless microphone* offers **Reserve 6** here; these cases leave it alone.
- **The coordinator's outcome notice** (SPM-65). Releasing the last line that needs
  attention sends it, and releasing an event's only line sends nothing. Both are
  unit-tested (`finishesReview` and `ReleaseEquipmentLineUseCase`, tagged SPM-108). In
  this seed, Tech Summit Keynote still has other lines needing attention, so no notice
  is sent.

The rules are unit-tested (`awaitsRelease`, `releaseEquipmentLine`, the use cases and
the mapper, all tagged SPM-108), including a Completed or Cancelled event and a line
released twice. These cases check the same rules end to end, through the real logins,
the `technical_support_release_equipment` function and the pages.

These cases are registered as `TC-RELEASE-001`–`TC-RELEASE-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them, tick
the boxes below **and** report each in the PR description's `## Manual test results`
table. CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the migrations and the seeded accounts exist, then the
  SPM-273 equipment review seed:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-equipment-review/seed.sql --local
  supabase db query --file scripts/seed-equipment-review/verify.sql --local
  ```
  Every `verify.sql` row should read `ok = true`.
- `pnpm dev:local`
- Use `http://localhost:3000`, not `127.0.0.1` (SPM-285).
- Run the cases in order: each starts where the one before left off. To start again,
  run `scripts/seed-equipment-review/teardown.sql`, then the seed.

### Test accounts (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `support@test.com` | Technical Support Staff | Releasing |
| `coordinator@test.com` | Event Coordinator | Tech Summit Keynote's coordinator; the access check |
| `coordinator2@test.com` | Event Coordinator | Product Launch Rehearsal's coordinator |

### The lines these cases use

| Event | Date | Line | Starts as |
| --- | --- | --- | --- |
| Tech Summit Keynote | 2026-11-15 | PA speaker 2 | Reserved 2, **Removal requested** |
| Product Launch Rehearsal | 2026-11-14 | — | No PA speaker line until TC-RELEASE-002 adds one |

5 PA speakers are owned, none out of service. Tech Summit Keynote's 2 are out on 14 and
15 Nov, so they count against Product Launch Rehearsal on 14 Nov.

---

## Test Cases

### TC-RELEASE-001: Nothing to release once the coordinator undoes the removal (AC3)

**Steps:**
1. Signed in as `support@test.com`, open *Tech Summit Keynote* from Needs review.
2. On **PA speaker**, click **Release 2**. Leave the confirmation open.
3. In another browser (or a private window), sign in as `coordinator@test.com`, open
   *Tech Summit Keynote*, click the **Equipment** tab, and click **Undo removal** on
   **PA speaker**.
4. Back as `support@test.com`, click **Yes, release**.
5. As `coordinator@test.com`, on **PA speaker** click **Remove**, then
   **Request removal**, to put the line back for the next cases.

**Expected Result:**
- Step 2: the Decision column reads *Release 2 × PA speaker? The line is removed from
  the event.* with **Yes, release** and **Keep**.
- Step 4: a toast reads *This line has nothing to release. Reload the page to see where
  it stands.* The page refreshes. **PA speaker** reads Requested **2** · Reserved **2**
  · Available **3**, with no Needs attention mark and *Reserved* in the Decision column.
- Step 5: the coordinator sees **Removal requested** and **Undo removal** on
  **PA speaker** again.

**Status:** [ ] Pass [ ] Fail

### TC-RELEASE-002: Held units are not available to an event the next day (AC2, before)

**Steps:**
1. Signed in as `coordinator2@test.com`, open *Product Launch Rehearsal*, click the
   **Equipment** tab, and add a line: **PA speaker**, quantity **4**, then **Add line**.
2. As `support@test.com`, open *Product Launch Rehearsal* from Needs review and read
   **PA speaker**.

**Expected Result:**
- Step 2: **PA speaker** reads Requested **4** · Reserved **0** · Available **3**
  (5 owned, less Tech Summit Keynote's 2) · **New**. Instead of a Reserve button, the
  Decision column shows a comment box and **Mark unfulfilled**.

**Status:** [ ] Pass [ ] Fail

### TC-RELEASE-003: Release a removal-requested line (AC1)

**Steps:**
1. As `support@test.com`, open *Tech Summit Keynote* and read **PA speaker**.
2. Click **Release 2**, then **Yes, release**.
3. Open `/staff/technical`.
4. As `coordinator@test.com`, open *Tech Summit Keynote*'s **Equipment** tab.

**Expected Result:**
- Step 1: Requested **2** · Reserved **2** · Available **3** · **Removal requested** ·
  **Release 2**.
- Step 2: a toast reads *2 × PA speaker released. They are free for other events.* The
  PA speaker row goes. Projector and Wireless microphone stay as they were.
- Step 3: *Tech Summit Keynote* reads *2 lines of 2 need attention*.
- Step 4: the lines are Projector and Wireless microphone. There is no PA speaker line.

**Status:** [ ] Pass [ ] Fail

### TC-RELEASE-004: Released units are available again (AC2, after)

**Steps:**
1. As `support@test.com`, open *Product Launch Rehearsal* and read **PA speaker**.

**Expected Result:**
- **PA speaker** reads Requested **4** · Reserved **0** · Available **5** · **New**,
  and the Decision column offers **Reserve 4**.

**Status:** [ ] Pass [ ] Fail

### TC-RELEASE-005: Only Technical Support Staff can release (AC4)

**Steps:**
1. Signed in as `coordinator@test.com`, open `/staff/technical/<id>`, using the id of
   *Tech Summit Keynote* from Technical Support's address bar.

**Expected Result:**
- The page reads *You don’t have access to this page.* and responds 403. There are no
  equipment lines and no Release button.

**Status:** [ ] Pass [ ] Fail
