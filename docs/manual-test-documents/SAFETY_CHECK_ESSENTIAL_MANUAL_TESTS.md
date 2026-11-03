# Safety Check Essential Lines Manual Tests (SPM-319)

## Overview

Browser checks for **SPM-319: Admit events with only non-essential gaps to the safety check**. An
event reaches the Safety Officer's **Awaiting check** list (`/staff/safety`) once every
**essential** equipment line is reserved in full. A line that is not essential, or that nobody has
marked, never holds it back. The rest of SPM-259's rule is unchanged: the event is Planning and its
live venue bookings are all Confirmed.

| AC | What it says | Cases |
| --- | --- | --- |
| AC1 | Only non-essential gaps: the event is listed | TC-SAFEESS-002, TC-SAFEESS-004 |
| AC2 | Any essential gap: the event is not listed | TC-SAFEESS-001, TC-SAFEESS-003, TC-SAFEESS-004 |
| AC3 | An unmarked line counts as non-essential | TC-SAFEESS-004 |

The rule is unit-tested (`awaitsSafetyCheck with essential lines (SPM-319)`), including each line
state and the reserved-quantity boundary. These cases check it end to end: the coordinator's
**Essential** switch (SPM-109), the candidate read, and the Safety Officer's list.

Not here: marking or unmarking a line does not notify the Safety Officers when it puts an event on
the list. SPM-262 sends that notice for bookings and equipment changes only; this is a known gap.

These cases are registered as `TC-SAFEESS-001`–`TC-SAFEESS-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

## Setup

1. Rebuild the database. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   ```
   Wait for `Finished supabase db reset`, then about 15 seconds.
2. Load the venues and the safety check events
   ([scripts/README.md](../../scripts/README.md#4-every-script)):
   ```bash
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-safety-check/seed.sql --local
   supabase db query --file scripts/seed-safety-check/verify.sql --local
   ```
   Every row of the last command must read `ok = true`.
3. Start the app with `pnpm dev:local`. Use two windows: a normal one signed in as
   `coordinator@test.com` and a private one signed in as `safety@test.com` (password
   `TestPass123!` for both).

The cases use two of the seeded events, both assigned to Test Coordinator:

| Event | Venue | Equipment | On the list at the start? |
| --- | --- | --- | --- |
| Charity Book Fair | Confirmed | Projector, 2 requested, none reserved, **marked essential** | No |
| Marina Bay Gala | Confirmed | Wireless microphone 4/4 and Crowd barrier 10/10, both reserved, not marked | Yes |

The coordinator opens an event from **My events** (the calendar-check icon in the left rail), then
its **Equipment** tab. The Safety Officer's list is the **Awaiting check** page, `/staff/safety`.

---

### TC-SAFEESS-001: An essential line not reserved keeps the event off the list (AC2)

**Preconditions:** Setup done. Signed in as `safety@test.com`.

**Steps:**
1. Open `/staff/safety`.

**Expected Result:**
- Step 1: **Marina Bay Gala** is listed. **Charity Book Fair** is not: its only line is essential and
  none of it is reserved.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step1-book-fair-not-listed](../screenshots/2026-10-20_TC-SAFEESS-001_step1-book-fair-not-listed.png)

---

### TC-SAFEESS-002: Unmarking the only gap puts the event on the list (AC1)

**Preconditions:** After TC-SAFEESS-001.

**Steps:**
1. As `coordinator@test.com`, open **My events** → **Charity Book Fair** → **Equipment** tab.
2. On the **Projector** line, switch **Essential** off.
3. As `safety@test.com`, reload `/staff/safety`.

**Expected Result:**
- Step 2: the switch stays off after a reload of the coordinator's page.
- Step 3: **Charity Book Fair** is listed, although none of its projectors is reserved.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step2-essential-off](../screenshots/2026-10-20_TC-SAFEESS-002_step2-essential-off.png) · [step3-book-fair-listed](../screenshots/2026-10-20_TC-SAFEESS-002_step3-book-fair-listed.png)

---

### TC-SAFEESS-003: Marking the line essential again takes the event off (AC2)

**Preconditions:** After TC-SAFEESS-002.

**Steps:**
1. As `coordinator@test.com`, on Charity Book Fair's **Equipment** tab, switch the Projector line's
   **Essential** back on.
2. As `safety@test.com`, reload `/staff/safety`.

**Expected Result:**
- Step 2: **Charity Book Fair** is no longer listed.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step2-book-fair-off-again](../screenshots/2026-10-20_TC-SAFEESS-003_step2-book-fair-off-again.png)

---

### TC-SAFEESS-004: A new, unmarked line does not hold the event back until it is marked (AC1, AC2, AC3)

**Preconditions:** Setup done. Marina Bay Gala is listed.

**Steps:**
1. As `coordinator@test.com`, open **My events** → **Marina Bay Gala** → **Equipment** tab.
2. Under **Add equipment**, choose **Projector**, enter **2** for **Quantity**, and click **Add line**.
   Leave **Essential** off.
3. As `safety@test.com`, reload `/staff/safety`.
4. As the coordinator, switch the new Projector line's **Essential** on.
5. As `safety@test.com`, reload `/staff/safety`.

**Expected Result:**
- Step 2: a Projector line, 2 requested and none reserved, with **Essential** off.
- Step 3: **Marina Bay Gala** is still listed. The new line is unmarked, so it counts as
  non-essential (AC3), and its gap is the only one (AC1).
- Step 5: **Marina Bay Gala** is no longer listed. An essential line is not reserved (AC2).

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step2-new-line-unmarked](../screenshots/2026-10-20_TC-SAFEESS-004_step2-new-line-unmarked.png) · [step3-gala-still-listed](../screenshots/2026-10-20_TC-SAFEESS-004_step3-gala-still-listed.png) · [step5-gala-off](../screenshots/2026-10-20_TC-SAFEESS-004_step5-gala-off.png)
