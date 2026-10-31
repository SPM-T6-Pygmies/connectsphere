# Equipment Re-reserve Manual Tests (SPM-316)

## Overview

Browser checks for **SPM-316: Re-reserve a changed equipment line**. When a
coordinator changes a line that has equipment reserved against it, the line goes
**Changed** with its units still held (SPM-41 AC8). On the event's page under
**Needs review** (`/staff/technical/<event>`), that line now offers the same choice
as a New one (SPM-274):

- **Reserve N** when enough are free for its new quantity. The units it already holds
  count as free for it, since reserving replaces them (AC1). The line returns to
  Reserved and leaves Needs review (AC5).
- Otherwise a comment box and **Mark unfulfilled**: all or nothing, so marking it
  releases every unit it held (AC2).

A lowered quantity is not fulfilled automatically: the line goes Changed like any
other change, its units still held, until Technical Support reserve it again at the new
quantity, which frees the surplus (AC3, as revised 2026-10-26).

**Available** on the page is how many *more* could be reserved, so on a line that
holds units the choice compares **Available + Reserved** with **Requested**. These cases
sit on both sides of that boundary.

What these cases do **not** cover:

- **Re-checking availability at the moment of saving** (AC4). It is the SPM-274 AC6
  check, under the item's row lock, and is unit-tested (`ReserveEquipmentLineUseCase`,
  tagged SPM-316).
- **A date change** (SPM-311). It releases every held unit, so those lines go through
  SPM-274 as they are: see [`EQUIPMENT_RESCHEDULE_MANUAL_TESTS.md`](EQUIPMENT_RESCHEDULE_MANUAL_TESTS.md).

The rules are unit-tested (`awaitsDecision`, `reserveEquipmentLine`,
`markEquipmentLineUnfulfilled`, `freeToReserve` and the use cases, all tagged SPM-316).
These cases check the same rules end to end, through the real logins, the
`technical_support_reserve_equipment` and `technical_support_mark_equipment_unfulfilled`
functions and the pages.

These cases are registered as `TC-RERESERVE-001`–`TC-RERESERVE-003` in
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
- Run the cases in order: each starts where the one before left off. When you are done,
  set **Wireless microphone**'s **Out of service** back to `0` on
  `/staff/technical/equipment`. To start again, run
  `scripts/seed-equipment-review/teardown.sql`, then the seed.

### Test accounts (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `support@test.com` | Technical Support Staff | Reserving, marking unfulfilled, setting out of service |
| `coordinator@test.com` | Event Coordinator | Tech Summit Keynote's coordinator; changing its lines |

### The lines these cases use

| Event | Date | Line | Starts as |
| --- | --- | --- | --- |
| Tech Summit Keynote | 2026-12-13 | Wireless microphone 6 (*was 4*) | Reserved 4, **Changed** |
| Tech Summit Keynote | 2026-12-13 | Projector 4 | Reserved 0, **New** |

30 Wireless microphones are owned, and other events have 2 out on Tech Summit Keynote's
days. With none out of service, the microphone line shows Available **24**. Setting 22
out of service leaves 6 free for it: the 4 it holds plus 2 more.

---

## Test Cases

### TC-RERESERVE-001: Reserve a raised line when exactly enough are free (AC1, AC5)

**Steps:**
1. Signed in as `support@test.com`, open `/staff/technical/equipment`. On the
   **Wireless microphone** card, set **Out of service** to `22` and click **Update**.
2. Open *Tech Summit Keynote* from Needs review and read **Wireless microphone**.
3. Click **Reserve 6**.
4. Read *Tech Summit Keynote* in the Needs review list.

**Expected Result:**
- Step 1: the card shows "Saved."
- Step 2: Requested **6** (*was 4*) · Reserved **4** · Available **2** · *Two on the
  stage* (*was: One on the stage*) · **Changed**, with **Reserve 6** in the Decision
  column. Only 2 more are free, but the 4 it holds count, so 6 is enough.
- Step 3: the row reads Requested **6** · Reserved **6** · Available **0**, with no
  Needs attention mark and *Reserved by Test Support Staff*.
- Step 4: *2 lines of 3 need attention* (it was 3 of 3).

**Status:** [x] Pass [ ] Fail — 28/10/2026, run locally by Jerrick

### TC-RERESERVE-002: Mark a raised line unfulfilled when one short, releasing what it held (AC2)

**Steps:**
1. Signed in as `coordinator@test.com`, open *Tech Summit Keynote*, click the
   **Equipment** tab. On **Wireless microphone**, press **Edit**, change the quantity to
   `7` and press **Save changes**.
2. As `support@test.com`, open *Tech Summit Keynote* and read **Wireless microphone**.
3. Type `Only 6 working microphones that day` in the comment box and click
   **Mark unfulfilled**.

**Expected Result:**
- Step 1: the line shows *Requested 7 · Reserved 6* with the **Reserved** and
  **Needs re-check** badges.
- Step 2: Requested **7** (*was 6*) · Reserved **6** · Available **0** · **Changed**.
  Instead of a Reserve button, the Decision column shows a comment box reading
  *e.g. only 6 available* and **Mark unfulfilled**.
- Step 3: the row reads Requested **7** · Reserved **0** · Available **6**, with
  **Unfulfilled**, the comment and *Marked by Test Support Staff*. The 6 it held are
  free again.

**Status:** [x] Pass [ ] Fail — 28/10/2026, run locally by Jerrick

### TC-RERESERVE-003: A lowered line waits for Technical Support, then frees the surplus (AC3)

**Steps:**
1. As `support@test.com`, open *Tech Summit Keynote* and click **Reserve 4** on
   **Projector**.
2. As `coordinator@test.com`, on the **Equipment** tab press **Edit** on **Projector**,
   change the quantity to `2` and press **Save changes**.
3. As `support@test.com`, reload *Tech Summit Keynote* and read **Projector**.
4. Click **Reserve 2**.

**Expected Result:**
- Step 1: **Projector** reads Requested **4** · Reserved **4** · Available **1**.
- Step 2: the line shows *Requested 2 · Reserved 4* with the **Reserved** and
  **Needs re-check** badges. Nothing was fulfilled automatically.
- Step 3: Requested **2** (*was 4*) · Reserved **4** · Available **1** · **Changed**,
  with **Reserve 2**.
- Step 4: Requested **2** · Reserved **2** · Available **3**, with no Needs attention
  mark. The 2 surplus units are free again.

**Status:** [x] Pass [ ] Fail — 28/10/2026, run locally by Jerrick
