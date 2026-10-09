# Equipment Catalogue Manual Tests (SPM-40)

## Overview
Manual browser tests for Technical Support Staff maintaining the equipment
catalogue on the **Equipment** page (`/staff/technical/equipment`, the box icon in
the sidebar): adding equipment from the **Add equipment** button and updating the
number owned and the location on the cards.

These cases are registered in [`../tests/manual-registry.csv`](../tests/manual-registry.csv)
as `TC-EQCAT-009` to `TC-EQCAT-016`. When you run them, report each in the PR
description's `## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

They were `TC-EQUIP-001`–`TC-EQUIP-008` until 2026-10-04; `TC-EQUIP` now
belongs to SPM-41's equipment requirement cases.

**Retired (SPM-17):** TC-EQCAT-001 to 007 were written for an in-memory catalogue
that emptied when the dev server restarted, and called the card's count
"Quantity". SPM-17 moved the page onto the real `equipment_item` table and renamed
the count **Owned**. TC-EQCAT-008 expected a 404 for other roles, where the app
answers with the shared 403 access-denied screen (SPM-16). All eight are kept as
`Retired` in the registry with their original wording and recorded passes, and
replaced here by:

| Retired | Replaced by |
| --- | --- |
| TC-EQCAT-001 | TC-EQCAT-009 |
| TC-EQCAT-002 | TC-EQCAT-010 |
| TC-EQCAT-003 | TC-EQCAT-011 |
| TC-EQCAT-004 | TC-EQCAT-012 |
| TC-EQCAT-005 | TC-EQCAT-013 |
| TC-EQCAT-006 | TC-EQCAT-014 |
| TC-EQCAT-007 | TC-EQCAT-015 |
| TC-EQCAT-008 | TC-EQCAT-016 |

Units out of service, added by SPM-17, are tested in
[`EQUIPMENT_OUT_OF_SERVICE_MANUAL_TESTS.md`](EQUIPMENT_OUT_OF_SERVICE_MANUAL_TESTS.md).

---

## Test Environment Setup

### Prerequisites
- Local Supabase, freshly reset, with no seed scripts run, so the catalogue is
  empty for TC-EQCAT-009:
  ```bash
  supabase start
  supabase db reset
  ```
- Running: `pnpm dev:local` (open it at `http://localhost:3000`)
- Run the cases in order: TC-EQCAT-010 adds the items the later cases change.
- Clean up afterwards: the run leaves `Projector (4K)` and a `Wireless microphone` of
  24 in the database, which are not the equipment types and counts of the
  Connectsphere Data Single Source of Truth. Run `supabase db reset` before loading
  any seed.

### Test Accounts (password `TestPass123!`)
- `support@test.com` (Technical Support Staff)
- `lead@test.com` (Event Coordinator Lead)

---

## Run record (retired cases)

The run below is of the retired TC-EQCAT-001 to 008, kept as their record.

Run on 2026-10-03, driven through a headless browser by Claude for Arin, on the
branch before its commit of this doc. **This run used
the in-memory stub and a sandbox-only stand-in for Supabase sign-in**, because no
Supabase project was available in the sandbox. Treat it as a sandbox result,
not a run against the real stack: re-run against `pnpm dev:local` with a real
sign-in and report it in your PR.

| Case | AC | Result | Screenshot |
| --- | --- | --- | --- |
| TC-EQCAT-001 | AC4 | Pass | `01-equipment-page-empty` |
| TC-EQCAT-002 | AC1 | Pass | `02-add-equipment-panel`, `03-two-cards` |
| TC-EQCAT-003 | AC1 | Pass | `04-invalid-add-refused` |
| TC-EQCAT-004 | AC2, AC3 | Pass | `05-update-persists-after-reload` |
| TC-EQCAT-005 | AC2 | Pass | `06-invalid-update-refused` |
| TC-EQCAT-006 | AC1 | Pass | `07-reviewed-has-no-catalogue` |
| TC-EQCAT-007 | AC1, AC2 | Pass | `08`, `09` |
| TC-EQCAT-008 | Role | Pass | `10-other-role-cannot-open-equipment` |

Screenshots are in [`../screenshots/`](../screenshots), named
`2026-10-03-spm-40-<nn>-<name>.png`.

---

## TC-EQCAT-009 The catalogue starts empty (AC4)

**Steps**
1. On a freshly reset database, log in as `support@test.com`.
2. Click **Equipment** in the sidebar (box icon, `/staff/technical/equipment`).

**Expected Result**
- The **Equipment catalogue** card says "The catalogue is empty. Use Add equipment to add the first item."
- No equipment is listed: nothing is imported from an existing equipment database.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-010 Add equipment (AC1)

**Steps**
1. Click **Add equipment** (top right of the card). A panel opens on the right.
2. Enter Type `Projector (4K)`, Description `Ceiling-mount capable`, Quantity `6`,
   Location `Store A`, and click **Add equipment** in the panel.
3. Add a second item the same way: Type `Wireless microphone`, no description, Quantity `24`, Location `Store A`.

**Expected Result**
- The panel closes after each add, and the item appears at once as its own card.
- Each card shows the type, the description under it (when there is one), **Owned**,
  **Location** and **Out of service** in editable fields, and an **Update** button.
- A new item starts with **Out of service** `0` and *In service: 6 of 6* (or *24 of 24*).
- The "catalogue is empty" message is gone.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-011 An invalid item is refused (AC1)

**Steps**
1. Open the **Add equipment** panel. Leave Type and Location blank, enter Quantity `-1`
   and Description `keep me`, and click **Add equipment** in the panel.

**Expected Result**
- Errors under Type ("Enter the equipment type."), Location ("Enter where the equipment is kept.")
  and Quantity ("Quantity must be a whole number, zero or more."), plus "Check the highlighted fields."
- The panel stays open with what was typed (`-1`, `keep me`) kept. No card is added.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-012 Update owned and location (AC2, AC3)

**Steps**
1. On the Projector (4K) card, change **Owned** to `4` and **Location** to `Store B`.
2. Click **Update**, then reload the page.

**Expected Result**
- The card shows "Saved." After the reload Projector (4K) still shows `4` at `Store B`,
  with *In service: 4 of 4*.
- The Wireless microphone card is unchanged (`24`, `Store A`).
- The screen reports counts per type and nothing finer (no per-unit records).

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-013 A bad update is refused (AC2)

**Steps**
1. On the Wireless microphone card, change **Owned** to `-5` and click **Update**. Reload.

**Expected Result**
- "Quantity must be a whole number, zero or more." appears on that card.
- After the reload Wireless microphone is still `24`.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-014 The catalogue lives only on the Equipment page (AC1)

**Steps**
1. Open **Needs review** (`/staff/technical`), **Reviewed** and **Archive** in turn.

**Expected Result**
- None of them shows the equipment catalogue; it is reached from **Equipment** in the sidebar.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-015 Usable at phone width (AC1, AC2)

**Steps**
1. Open `/staff/technical/equipment` in a 390px-wide window. (On a phone, **Equipment** is in the
   menu drawer behind the last button of the bottom bar, not in the bar itself.)
2. Tap **Add equipment**.

**Expected Result**
- Cards stack one per row with labelled **Owned**, **Location** and **Out of service** fields,
  the in-service count and **Update**.
- The Add equipment panel opens beside a sliver of the page, and every field fits on screen.
- The page does not scroll sideways.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

## TC-EQCAT-016 Other roles cannot open the Equipment page

**Steps**
1. Log in as `lead@test.com` and open `/staff/technical/equipment` directly, with the
   browser's Network tab open.

**Expected Result**
- The shared access-denied screen: "You don’t have access to this page." and "Please
  contact your respective Technical Support Staff.", with a link back to your workspace.
- The Network tab shows **403** for the page request (SPM-16).
- No catalogue content is shown.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick
