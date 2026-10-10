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

These cases are registered as `TC-OOS-001`, `002`, `005`, `006` and `007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them,
tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

**Retired:** TC-OOS-003 did not mention the warning its step 3 now shows. Owned 3 with
3 out of service leaves none of the PA speakers in service while *Tech Summit Keynote*
holds 2, so SPM-274 (AC7) names that event on the card
([`EQUIPMENT_RESERVE_MANUAL_TESTS.md`](EQUIPMENT_RESERVE_MANUAL_TESTS.md)). It is kept as
`Retired` in the registry with its original wording and its recorded passes, and is
replaced here by:

| Retired | Replaced by |
| --- | --- |
| TC-OOS-003 | TC-OOS-006 |

The replacement checks the same SPM-17 rule, and says which steps show the warning.

TC-OOS-004 is retired too: SPM-273 AC4 now counts availability per day, so the Projector
figures it reads on *Tech Summit Keynote* change from 4, 2 and 4 to 5, 3 and 5. It is
replaced by TC-OOS-007, which checks the same SPM-17 rule with the new figures.

| Retired | Replaced by |
| --- | --- |
| TC-OOS-004 | TC-OOS-007 |

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset, then the SPM-273 seed, which gives a catalogue and the
  events whose availability TC-OOS-007 reads:
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
| Livestream kit | 2 | 0 | Store room B |
| PA speaker | 5 | 0 | Store room B |
| Projector | 10 | 0 | Store room A |
| Wireless microphone | 30 | 0 | Store room A |

These are four of the six equipment types of the Connectsphere Data Single Source of
Truth, with the same counts `seed-equipment` gives them.

---

## Test Cases

### TC-OOS-001: Set units out of service, and return them (AC1, AC3)

**Steps:**
1. Open `/staff/technical/equipment` and read the Projector card.
2. Set **Out of service** to `2` and click **Update**. Reload the page.
3. Set **Out of service** back to `0` and click **Update**.

**Expected Result:**
- Step 1: the card shows **Owned** `10`, **Out of service** `0` and *In service: 10 of 10*.
- Step 2: the card shows "Saved."; after the reload it still shows **Out of service** `2`
  and *In service: 8 of 10*.
- Step 3: "Saved."; *In service: 10 of 10*. Every unit is back in service.

**Status:** [x] Pass [ ] Fail — 9/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-projector-card](../screenshots/2026-10-09_TC-OOS-001_step1-projector-card.png) · [step2-two-out-of-service](../screenshots/2026-10-09_TC-OOS-001_step2-two-out-of-service.png) · [step3-returned-to-service](../screenshots/2026-10-09_TC-OOS-001_step3-returned-to-service.png)

---

### TC-OOS-002: Out of service must be from 0 up to the number owned (AC2)

**Steps:**
1. On the Livestream kit card (Owned `2`), set **Out of service** to `3` and click **Update**.
2. Set it to `-1`, then `1.5`, clicking **Update** each time.
3. Set it to `2` and click **Update**.
4. Set it back to `0` and click **Update**. Reload.

**Expected Result:**
- Step 1: "Out of service must be a whole number from 0 up to the number owned (2)." on the card.
- Step 2: "Out of service must be a whole number, zero or more." each time.
- Step 3: "Saved."; *In service: 0 of 2*.
- Step 4: "Saved."; after the reload *In service: 2 of 2*. None of the refused values was saved.

**Status:** [x] Pass [ ] Fail — 9/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-three-refused](../screenshots/2026-10-09_TC-OOS-002_step1-three-refused.png) · [step2-fraction-refused](../screenshots/2026-10-09_TC-OOS-002_step2-fraction-refused.png) · [step3-two-of-two-out](../screenshots/2026-10-09_TC-OOS-002_step3-two-of-two-out.png) · [step4-back-to-two-of-two](../screenshots/2026-10-09_TC-OOS-002_step4-back-to-two-of-two.png)

---

### TC-OOS-007: Units out of service are not counted as available (AC4)

**Steps:**
1. Open **Needs review**, open *Tech Summit Keynote* (15 Nov) and read **Available** for Projector.
2. On the Equipment page set Projector **Out of service** to `2` and click **Update**.
3. Open *Tech Summit Keynote* again and read **Available** for Projector.
4. Set Projector **Out of service** back to `0`, then read **Available** once more.

**Expected Result:**
- Step 1: **5**. The event's units are out on 14 and 15 Nov, and the busier of the two is
  14 Nov, with 5 out (3 for the event on 14 Nov and 2 for the one on 15 Nov). 10 owned,
  less those 5.
- Step 3: **3** — the 2 units out of service are left out.
- Step 4: **5** again.

**Status:** [ ] Pass [ ] Fail

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

**Clean up:** this case leaves a `Smoke machine` type in the database, which is not one of
the six in the SSOT. Run `supabase db reset` and re-seed, or delete it (nothing references
it): `delete from equipment_item where type = 'Smoke machine';`.

**Status:** [x] Pass [ ] Fail — 9/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-smoke-machine-added](../screenshots/2026-10-09_TC-OOS-005_step1-smoke-machine-added.png) · [step2-coordinator-type-list](../screenshots/2026-10-09_TC-OOS-005_step2-coordinator-type-list.png) · [step3-smoke-machine-after-restart](../screenshots/2026-10-09_TC-OOS-005_step3-smoke-machine-after-restart.png)

---

### TC-OOS-006: Owned cannot drop below the units out of service (AC2)

**Steps:**
1. On the PA speaker card (Owned `5`), set **Out of service** to `3` and click **Update**.
2. Set **Owned** to `2` and click **Update**. Reload.
3. Set **Owned** to `3` and click **Update**.
4. Set **Owned** to `5`, **Out of service** to `0`, and click **Update**.

**Expected Result:**
- Step 1: "Saved."; *In service: 2 of 5*. No warning: the 2 in service cover the 2
  *Tech Summit Keynote* holds.
- Step 2: "Out of service must be a whole number from 0 up to the number owned (2)."; after the
  reload the card still shows **Owned** `5` and **Out of service** `3`. Nothing was saved.
- Step 3: "Saved."; *In service: 0 of 3*. Owned may drop to exactly the out-of-service count.
  The card also shows the warning *Not enough in service on these dates* reading
  *14–15 Nov (2 reserved but only 0 in service): Tech Summit Keynote (15 Nov) has 2
  reserved* — expected (SPM-274 AC7): the save still went through.
- Step 4: "Saved."; *In service: 5 of 5*, and no warning.

**Status:** [ ] Pass [ ] Fail
