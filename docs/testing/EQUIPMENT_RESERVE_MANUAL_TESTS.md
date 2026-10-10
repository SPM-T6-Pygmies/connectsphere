# Equipment Reservation Manual Tests (SPM-274)

## Overview

Browser checks for **SPM-274: Reserve equipment for events**. On an event's page under
**Needs review** (`/staff/technical/<event>`), each line awaiting a decision has its
action in the **Decision** column:

- **Reserve N** when at least the quantity requested is available — a line is reserved
  in full or not at all (AC1);
- a comment box and **Mark unfulfilled** when fewer are available (AC3);
- *Needs a date before equipment can be reserved.* when the event has no date (AC2).

A line awaits a decision when nothing is reserved against it and it is **New**, or
**Changed** by the coordinator after being marked unfulfilled (AC4). Units reserved for
one event are not available to another from the day before to the day after (AC5), and
what is free is checked again when you reserve (AC6). On the **Equipment** page, a save
that leaves fewer in service than upcoming events hold still goes through, and the card
names those events (AC7).

What SPM-274 does **not** cover, so is not tested here:

- **Changed or Removal requested lines that have equipment reserved**: releasing or
  replacing a reservation is SPM-108. Those lines show no action.
- **Telling the coordinator** of the outcome: SPM-65.

The rules are unit-tested (`awaitsDecision`, `reserveEquipmentLine`,
`markEquipmentLineUnfulfilled`, `eventsHoldingMoreThanInService`, the use cases and the
mappers, all tagged SPM-274), including exactly the quantity requested available, one
fewer, a comment of 500 and 501 characters, and an event today or yesterday. These cases
check the same rules end to end, through the real logins, the
`technical_support_reserve_equipment`, `technical_support_mark_equipment_unfulfilled`
and `technical_support_equipment_reservations` functions, and the pages.

These cases are registered as `TC-RESERVE-001`–`TC-RESERVE-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them, tick
the boxes below **and** report each in the PR description's `## Manual test results`
table — CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the migrations and the seeded accounts exist, then the
  SPM-274 seed:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-equipment-reserve/seed.sql --local
  supabase db query --file scripts/seed-equipment-reserve/verify.sql --local
  ```
  `verify.sql` should show 14 rows, all `ok = true`.
- `pnpm dev:local`
- Use `http://localhost:3000`, not `127.0.0.1`: Next's dev server blocks its client
  scripts for `127.0.0.1`, so the coordinator event page's tabs do not switch (SPM-285).
- Run the cases in order: each starts where the one before left off. To start again,
  run `scripts/seed-equipment-reserve/teardown.sql`, then the seed.

### Test accounts (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `support@test.com` | Technical Support Staff (*Test Support Staff*) | Reserving and marking lines |
| `support2@test.com` | Technical Support Staff (*Test Support Staff 2*) | The first reservation in TC-RESERVE-006 |
| `coordinator@test.com` | Event Coordinator | Every seeded event's coordinator |

### The seeded events

Every line starts **New**, with nothing reserved.

| Event | Date | Status | Lines |
| --- | --- | --- | --- |
| Design Sprint Demo | 2026-11-20 | Planning | Presentation laptop 6 · PA speaker 3 |
| Sales Kickoff | 2026-11-21 | Planning | Presentation laptop 3 · Wireless microphone 2 |
| Board Offsite | 2026-11-20 | Confirmed | PA speaker 3 |
| Press Briefing | no date | Planning | Projector 1 |

Owned: Presentation laptop 8, PA speaker 5, Wireless microphone 30, Projector 10 — none
out of service. These are four of the six equipment types of the Connectsphere Data
Single Source of Truth, with the same counts `seed-equipment` gives them, so either seed
can be loaded first. No other seed's event is within a day of 20 or 21 Nov, so loading
others alongside does not change the numbers below.

---

## Test Cases

### TC-RESERVE-001: Reserve a New line in full (AC1)

**Steps:**
1. Signed in as `support@test.com`, open `/staff/technical` and open *Design Sprint Demo*.
2. On **Presentation laptop**, read the row, then click **Reserve 6**.
3. Open `/staff/technical` again.
4. Sign in as `coordinator@test.com`, open **My events**, open *Design Sprint Demo* and
   click the **Equipment** tab.

**Expected Result:**
- Step 2: before: Requested **6**, Reserved **0**, Available **8**, **New**, **Reserve 6**.
  After: Reserved **6**, no **New** mark, and the Decision column reads
  *Reserved by Test Support Staff*.
- Step 3: *Design Sprint Demo* reads *1 line of 2 needs attention* (the PA speaker).
- Step 4: **Presentation laptop** has a **Reserved** badge and reads
  *Requested 6 · Reserved 6 · Reserved by Test Support Staff*.

**Status:** [ ] Pass [ ] Fail

---

### TC-RESERVE-002: Units reserved for one event are not available to another a day away (AC5)

**Preconditions:** TC-RESERVE-001 passed.

**Steps:**
1. Signed in as `support@test.com`, open *Sales Kickoff* (21 Nov, the day after
   *Design Sprint Demo*) and read the **Presentation laptop** row.

**Expected Result:**
- Available **2**: the 8 owned, less the 6 reserved for *Design Sprint Demo*.
- There is no **Reserve** button — 2 is fewer than the 3 requested — only a comment box
  and **Mark unfulfilled**.

**Status:** [ ] Pass [ ] Fail

---

### TC-RESERVE-003: Mark a line unfulfilled when too few are available (AC3)

**Preconditions:** TC-RESERVE-002 passed; *Sales Kickoff* is open.

**Steps:**
1. On **Presentation laptop**, leave the comment empty and click **Mark unfulfilled**.
2. Type `only 2 available` and click **Mark unfulfilled**.
3. Read the **Wireless microphone** row.
4. Open `/staff/technical`.
5. Sign in as `coordinator@test.com`, open *Sales Kickoff* and click the **Equipment** tab.

**Expected Result:**
- Step 1: *Say why the line cannot be fulfilled, e.g. "only 3 available".* Nothing is saved.
- Step 2: Reserved stays **0**, the **New** mark goes, and the Decision column shows an
  **Unfulfilled** badge, *only 2 available* and *Marked by Test Support Staff*.
- Step 3: unchanged — **New**, Available **30**, **Reserve 2**.
- Step 4: *Sales Kickoff* reads *1 line of 2 needs attention*.
- Step 5: **Presentation laptop** has an **Unfulfilled** badge, *Requested 3 · Reserved 0*,
  and *only 2 available — Test Support Staff, Technical Support*.

**Status:** [ ] Pass [ ] Fail

---

### TC-RESERVE-004: A changed unfulfilled line comes back for review (AC4)

**Preconditions:** TC-RESERVE-003 passed.

**Steps:**
1. Signed in as `coordinator@test.com`, on *Sales Kickoff*'s **Equipment** tab click **Edit** on
   **Presentation laptop**, set the quantity to `2` and click **Save changes**.
2. Sign in as `support@test.com` and open *Sales Kickoff*.
3. As the coordinator, edit **Presentation laptop** back to `3` and save.
4. As Technical Support, reload *Sales Kickoff*.
5. As the coordinator, edit it to `2` again and save.
6. As Technical Support, reload *Sales Kickoff* and click **Reserve 2**.

**Expected Result:**
- Step 1: the line shows **Needs re-check** and *Requested 2 · Reserved 0*.
- Step 2: **Presentation laptop** reads Requested **2** *was 3*, Reserved **0**, Available
  **2**, **Changed**, with **Reserve 2**.
- Step 3: the line is **Unfulfilled** again, with *only 2 available — Test Support Staff,
  Technical Support*.
- Step 4: no attention mark; the Decision column shows **Unfulfilled**, *only 2
  available*, *Marked by Test Support Staff*.
- Step 6: Reserved **2** and *Reserved by Test Support Staff*.

**Status:** [ ] Pass [ ] Fail

---

### TC-RESERVE-005: Nothing can be reserved for an event with no date (AC2)

**Steps:**
1. Signed in as `support@test.com`, open *Press Briefing* and read the
   **Projector** row.

**Expected Result:**
- Available reads *Event has no date yet*, the line is **New**, and the Decision column
  reads *Needs a date before equipment can be reserved.* with no button.

**Status:** [ ] Pass [ ] Fail

---

### TC-RESERVE-006: Availability is checked again when reserving (AC6)

**Steps:**
1. In one browser, signed in as `support@test.com`, open *Board Offsite* (20 Nov) and
   read the **PA speaker** row. Leave the page open.
2. In a second browser (or a private window), sign in as `support2@test.com`, open
   *Design Sprint Demo* (also 20 Nov) and click **Reserve 3** on **PA speaker**.
3. Back in the first browser, without reloading, click **Reserve 3**.

**Expected Result:**
- Step 1: Available **5**, **Reserve 3**.
- Step 2: *Reserved by Test Support Staff 2*.
- Step 3: *Only 2 available, fewer than the 3 requested, so nothing was reserved. Mark
  the line unfulfilled instead.* The row refreshes to Available **2**, Reserved **0**,
  still **New**, now with **Mark unfulfilled** in place of **Reserve 3**.

**Status:** [ ] Pass [ ] Fail

---

### TC-RESERVE-007: Units out of service that leave too few name the events affected (AC7)

**Preconditions:** TC-RESERVE-001 and 004 passed: 6 presentation laptops reserved for
*Design Sprint Demo* (20 Nov) and 2 for *Sales Kickoff* (21 Nov).

**Steps:**
1. Signed in as `support@test.com`, open the **Equipment** page and, on the
   **Presentation laptop** card, set **Out of service** to `1` and click **Update**.
2. Reload the page.
3. Set **Out of service** back to `0` and click **Update**.

**Expected Result:**
- Step 1: *Saved.* and *In service: 7 of 8*, with a warning *Fewer in service than these
  events hold* listing:
  - *Design Sprint Demo (2026-11-20): 8 held over its days (6 its own)*
  - *Sales Kickoff (2026-11-21): 8 held over its days (2 its own)*
- Step 2: the card still shows **Out of service** `1` — the save went through.
- Step 3: *Saved.*, *In service: 8 of 8*, and no warning.

**Status:** [ ] Pass [ ] Fail
