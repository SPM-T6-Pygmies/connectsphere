# Essential Equipment Manual Tests (SPM-109)

## Overview

Browser checks for **SPM-109: Mark an equipment line as essential**. On the
coordinator's event page, **Equipment** tab, each line of an event that can still
change has an **Essential** switch. The coordinator switches it on once they and the
assigned Technical Support Staff agree the line is essential. How they agree
happens outside the system; the switch records the outcome (AC2). It saves as soon
as it is switched.

- Every line starts **not essential** (AC4).
- The mark is per line: switching one line leaves the others as they were (AC3).
- Technical Support see an **Essential** badge on their line view
  (`/staff/technical/<event>`) and have no control for it (AC2).

What SPM-109 does **not** cover, so is not tested here:

- **What the mark does**: blocking confirmation on an essential line is SPM-318, and
  admitting events with only non-essential gaps to the safety check is SPM-319.
- **A Completed or Cancelled event**: its lines are read-only, so the switch is
  replaced by a badge. The refusal is unit-tested (`markEquipmentLineEssential` and
  `MarkEquipmentLineEssentialUseCase`, tagged SPM-109) and checked in the
  `coordinator_set_equipment_line_essential` function.

The rules are unit-tested (the domain, the use case, the form schema and both
mappers, all tagged SPM-109). These cases check them end to end, through the real
logins, the `coordinator_set_equipment_line_essential` function and both pages.

These cases are registered as `TC-ESSENTIAL-001`–`TC-ESSENTIAL-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them, tick
the boxes below **and** report each in the PR description's `## Manual test results`
table — CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset, then the baseline seeds
  ([scripts/README.md](../../scripts/README.md#1-set-up-your-database)):
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  supabase db query --file scripts/seed-equipment/seed.sql --local
  ```
- `pnpm dev:local`
- Use `http://localhost:3000`, not `127.0.0.1`: Next's dev server blocks its client
  scripts for `127.0.0.1`, so the coordinator event page's tabs do not switch (SPM-285).
- Run the cases in order: each starts where the one before left off.

### Test accounts (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | Marking lines on *Founders' Gala Dinner* |
| `support@test.com` | Technical Support Staff | Seeing the mark |

### The seeded event

*Founders' Gala Dinner*, Planning, assigned to Test Coordinator, with two lines:
**Projector** 2 (reserved) and **Wireless microphone** 4 (nothing reserved).

---

## Test Cases

### TC-ESSENTIAL-001: Mark a line essential (AC1, AC3, AC4)

**Steps:**
1. Signed in as `coordinator@test.com`, open **My events**, open *Founders' Gala
   Dinner* and click the **Equipment** tab.
2. Read both lines.
3. Switch **Essential** on for **Projector**.
4. Reload the page.

**Expected Result:**
- Step 2: both lines have an **Essential** switch, off, reading
  *Mark once agreed with Technical Support*.
- Step 3: the Projector switch stays on. Nothing else about the line changes: it is
  still **Reserved**, *Requested 2 · Reserved 2*, with no **Needs re-check** badge.
- Step 4: Projector's switch is on; Wireless microphone's is still off.

**Status:** [ ] Pass [ ] Fail

---

### TC-ESSENTIAL-002: Technical Support see which lines are essential (AC2)

**Preconditions:** TC-ESSENTIAL-001 passed.

**Steps:**
1. Sign in as `support@test.com`, open `/staff/technical` and open *Founders' Gala
   Dinner*.

**Expected Result:**
- **Projector** has an **Essential** badge beside its name; **Wireless microphone**
  has none.
- There is no switch or other control for the mark anywhere on the page.

**Status:** [ ] Pass [ ] Fail

---

### TC-ESSENTIAL-003: Mark a line not essential again (AC1)

**Preconditions:** TC-ESSENTIAL-002 passed.

**Steps:**
1. As `coordinator@test.com`, on *Founders' Gala Dinner*'s **Equipment** tab, switch
   **Essential** off for **Projector**, then reload.
2. As `support@test.com`, reload *Founders' Gala Dinner*.

**Expected Result:**
- Step 1: Projector's switch is off after the reload.
- Step 2: neither line has an **Essential** badge.

**Status:** [ ] Pass [ ] Fail
