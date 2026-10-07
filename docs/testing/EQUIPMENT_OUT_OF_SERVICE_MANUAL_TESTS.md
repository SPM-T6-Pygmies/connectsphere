# Equipment Out of Service Manual Tests (SPM-17)

## Overview

Browser checks for **SPM-17: Mark equipment out of service**. Technical Support
Staff record, on each card of the **Equipment** page (`/staff/technical/equipment`),
how many units of a type are out of service. The card shows **Owned**, **Out of
service** and how many are in service, and units out of service are left out of
the availability shown on Needs review's event pages (SPM-273 AC4). The page now
reads and writes the same `equipment_item` records coordinators pick from.

What SPM-17 does **not** cover, so is not tested here:

- **Why** a unit is out of service (damaged, under maintenance, unavailable) —
  Backlog ([#23](https://github.com/SinYang13/IS212-2026/discussions/23)).
- **Logging defects on return** — Backlog ([#86](https://github.com/SinYang13/IS212-2026/discussions/86)).
- **Adding and editing catalogue items** themselves — SPM-40
  ([`2026-09-30-equipment-catalogue-manual-tests.md`](2026-09-30-equipment-catalogue-manual-tests.md)).

The rules are unit-tested (`updateEquipmentStock (SPM-17)`, `unitsInService (SPM-17)`,
`unitsAvailable (SPM-17)`, `UpdateEquipmentStockUseCase (SPM-17)` and the catalogue
mapper), including exactly the number owned, one more, and owned lowered to exactly
the out-of-service count. These cases check the same rules end to end, through the
real login, the `technical_support_*` catalogue functions and the pages.

These cases are registered as `TC-OOS-001`–`TC-OOS-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them,
tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset, then the SPM-273 seed, which gives a catalogue and the
  events whose availability TC-OOS-004 reads:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-equipment-review/seed.sql --local
  supabase db query --file scripts/seed-equipment-review/verify.sql --local
  ```
- For TC-OOS-005 also seed the coordinator's event:
  ```bash
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-equipment/seed.sql --local
  ```
- `pnpm dev:local`
- Run the cases in order, signed in as `support@test.com` unless a step says otherwise.
  Each case puts the counts back the way it found them.

### Test accounts (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `support@test.com` | Technical Support Staff | The Equipment page and Needs review |
| `coordinator@test.com` | Event Coordinator | Picking equipment for an event (TC-OOS-005) |

### The seeded catalogue

| Type | Owned | Out of service | Location |
| --- | --- | --- | --- |
| Handheld microphone | 8 | 0 | Store room C |
| Laser projector | 10 | 0 | Store room C |
| Lectern | 3 | 0 | Store room D |
| Stage monitor | 4 | 0 | Store room D |

---

## Test Cases

### TC-OOS-001: Set units out of service, and return them (AC1, AC3)

**Steps:**
1. Open `/staff/technical/equipment` and read the Laser projector card.
2. Set **Out of service** to `2` and click **Update**. Reload the page.
3. Set **Out of service** back to `0` and click **Update**.

**Expected Result:**
- Step 1: the card shows **Owned** `10`, **Out of service** `0` and *In service: 10 of 10*.
- Step 2: the card shows "Saved."; after the reload it still shows **Out of service** `2`
  and *In service: 8 of 10*.
- Step 3: "Saved."; *In service: 10 of 10*. Every unit is back in service.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-OOS-002: Out of service must be from 0 up to the number owned (AC2)

**Steps:**
1. On the Lectern card (Owned `3`), set **Out of service** to `4` and click **Update**.
2. Set it to `-1`, then `1.5`, clicking **Update** each time.
3. Set it to `3` and click **Update**.
4. Set it back to `0` and click **Update**. Reload.

**Expected Result:**
- Step 1: "Out of service must be a whole number from 0 up to the number owned (3)." on the card.
- Step 2: "Out of service must be a whole number, zero or more." each time.
- Step 3: "Saved."; *In service: 0 of 3*.
- Step 4: "Saved."; after the reload *In service: 3 of 3*. None of the refused values was saved.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-OOS-003: Owned cannot drop below the units out of service (AC2)

**Steps:**
1. On the Stage monitor card (Owned `4`), set **Out of service** to `3` and click **Update**.
2. Set **Owned** to `2` and click **Update**. Reload.
3. Set **Owned** to `3` and click **Update**.
4. Set **Owned** to `4`, **Out of service** to `0`, and click **Update**.

**Expected Result:**
- Step 1: "Saved."; *In service: 1 of 4*.
- Step 2: "Out of service must be a whole number from 0 up to the number owned (2)."; after the
  reload the card still shows **Owned** `4` and **Out of service** `3`. Nothing was saved.
- Step 3: "Saved."; *In service: 0 of 3*. Owned may drop to exactly the out-of-service count.
- Step 4: "Saved."; *In service: 4 of 4*.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-OOS-004: Units out of service are not counted as available (AC4)

**Steps:**
1. Open **Needs review**, open *Tech Summit Keynote* and read **Available** for Laser projector.
2. On the Equipment page set Laser projector **Out of service** to `2` and click **Update**.
3. Open *Tech Summit Keynote* again and read **Available** for Laser projector.
4. Set Laser projector **Out of service** back to `0`, then read **Available** once more.

**Expected Result:**
- Step 1: **4** (10 owned, less 3, 2 and 1 held by the events on 14, 15 and 16 Nov).
- Step 3: **2** — the 2 units out of service are left out.
- Step 4: **4** again.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-OOS-005: The Equipment page and the coordinator use the same records (AC5)

**Steps:**
1. On the Equipment page, add `Smoke machine`, Quantity `2`, Location `Store room D`.
2. Sign out, sign in as `coordinator@test.com`, open **My events**, open *Founders' Gala Dinner*,
   and open the type list under **Add equipment**.
3. Stop the dev server, start it again (`pnpm dev:local`), sign in as `support@test.com` and open
   the Equipment page.

**Expected Result:**
- Step 2: the coordinator's type list includes **Smoke machine**, alongside the seeded types.
- Step 3: the Smoke machine card is still there, with **Owned** `2` and *In service: 2 of 2*.
  Restarting the app does not empty the catalogue.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick
