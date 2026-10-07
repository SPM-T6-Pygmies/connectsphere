# Equipment Requirements Manual Tests (SPM-41)

## Overview

Browser checks for **SPM-41: Specify equipment requirements for an event**, run
against the real app and database. The rules behind the screens are unit-tested
(tagged `SPM-182` to `SPM-187`); these cases cover what a unit test cannot: that
the pages show the right thing, that the warning appears before a reserved line is
saved, and that a change made by the coordinator reaches Technical Support.

A reserved line the coordinator changes, or asks to remove, goes from **Reserved**
to **Under review**: the coordinator's screens show this as the **Needs re-check** badge, and
it is what puts the event on Technical Support's **Needs review** list, with the line marked
**Changed** or **Removal requested** on the event's page there. Since SPM-273 a line nothing is
reserved against puts the event on that list too, marked **New**
([`EQUIPMENT_REVIEW_MANUAL_TESTS.md`](EQUIPMENT_REVIEW_MANUAL_TESTS.md)). TC-EQUIP-009 checks the state
itself in the database. TC-EQUIP-016 checks that editing a line back to what Technical Support
reserved against clears the re-check, and TC-EQUIP-017 that withdrawing a removal request does the same. The access-denied screen in TC-EQUIP-015 comes from SPM-16
([`ACCESS_DENIED_MANUAL_TESTS.md`](ACCESS_DENIED_MANUAL_TESTS.md)).

The cases are specified in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-EQUIP-001`, `002`, `006`, `007`, `009` and `012` to `017`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI records it in
`manual-runs.csv` when the PR merges, so do not edit that file. The ticked boxes and screenshots
below are the working record for this run.

**Retired:** TC-EQUIP-003, 004, 005, 008, 010 and 011 checked SPM-41's "Needs re-check" card,
which SPM-273 replaced with the Needs review page. They are kept as `Retired` in the registry
with their original wording and their recorded passes, and are replaced here by:

| Retired | Replaced by |
| --- | --- |
| TC-EQUIP-003 | TC-EQUIP-012 |
| TC-EQUIP-004 | TC-EQUIP-013 |
| TC-EQUIP-005 | TC-EQUIP-014 |
| TC-EQUIP-008 | TC-EQUIP-015 |
| TC-EQUIP-010 | TC-EQUIP-016 |
| TC-EQUIP-011 | TC-EQUIP-017 |

The replacements check the same coordinator behaviour, and read Technical Support's side from the
Needs review list and the event's equipment page.

**Last run:** all eleven original cases passed on 3/10/2026 at commit `7e4ed7d`, the merge of `main`
into the SPM-41 branch (see each case's Status and Screenshots). A browser script drove the cases and checked each expected result,
including the database checks (85 checks in all); the screenshots are in [`../screenshots/`](../screenshots/).

**Run the cases in order**, or re-seed (below) between them: TC-EQUIP-013 changes
the reserved Projector line, and later cases expect that.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed, the sample requests and the equipment seed:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-equipment/seed.sql --local
  ```
  `supabase db query --file scripts/seed-equipment/verify.sql --local` should show 8
  rows, all `ok = t`.
- `pnpm dev:local`

### Re-seeding the equipment (between runs)

```bash
supabase db query --file scripts/seed-equipment/teardown.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

### Test accounts

Password for both: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Used for |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | Recording, editing and removing lines |
| `support@test.com` | Technical Support Staff | The Needs review list and the event's equipment page (SPM-273) |
| `venue@test.com` | Venue Staff | Being refused the list (TC-EQUIP-015) |

### The seeded event

**Founders' Gala Dinner**, Planning, assigned to Test Coordinator. Open **My events** in the
sidebar and click the event (its page is `/staff/coordinator/events/<id>`). The equipment
section is only on this event page: the approved *request* page for the same event shows
the Organiser's stated text as a read-only field and has no way to add lines. It has
two lines:

| Type | Requested | Reserved | State |
| --- | --- | --- | --- |
| Projector | 2 | 2 | Reserved, notes "HDMI input; mounted above the stage." |
| Wireless microphone | 4 | 0 | Not reserved |

The Organiser's stated needs for it are whatever the request recorded; the case
below sets a known value.

---

## Test Cases

### TC-EQUIP-001: Add a line, with the Organiser's stated needs beside it (AC1, AC6)

**Preconditions:** Signed in as `coordinator@test.com`. Give the event a stated
need to look for:

```sql
update event set equipment_requirements = 'Two projectors and a stage microphone for the keynote.'
 where name = 'Founders'' Gala Dinner';
```

**Steps:**
1. Open the Founders' Gala Dinner page and find **Equipment requirements**.
2. Read the box labelled **Stated by the Organiser**.
3. Under **Add equipment**, choose **Livestream kit**, enter quantity `1` and the
   technical requirements `Needs a wired connection`, then press **Add line**.

**Expected Result:**
- The Organiser's words appear in the box above the lines (AC6).
- A **Livestream kit** line appears with *Requested 1 · Reserved 0* and its notes,
  with no badges (AC1).
- The Projector and Wireless microphone lines are unchanged.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7e4ed7d`, run in Chrome via Playwright for JameszLau (8/8 checks)

**Screenshots:** [step1-organiser-needs-and-lines](../screenshots/2026-10-03_TC-EQUIP-001_step1-organiser-needs-and-lines.jpg) · [step3-livestream-line-added](../screenshots/2026-10-03_TC-EQUIP-001_step3-livestream-line-added.jpg)

---

### TC-EQUIP-002: The add form refuses what the rules refuse (AC2, AC3, AC4, AC5)

**Preconditions:** As TC-EQUIP-001, which leaves Livestream kit on the event.

**Steps:** In **Add equipment**, try each row and note the message:

| Type | Quantity | Notes | Expected |
| --- | --- | --- | --- |
| Livestream kit | 1 | — | Refused: the event already has a line for that type — edit the existing line (AC2) |
| PA speaker | `0` | — | Refused: quantity must be a whole number of at least 1 (AC3) |
| PA speaker | `1.5` | — | Refused: same message (AC3) |
| PA speaker | `abc` | — | Refused: "Enter the quantity as a number." (AC3) |
| *(none chosen)* | `1` | — | Refused: "Choose an equipment type." (AC4) |
| PA speaker | `1` | 501 characters | Refused: notes too long (AC5) |
| PA speaker | `1` | exactly 500 characters | **Accepted** (AC5) |
| Presentation laptop | `1` | — | **Accepted**: 1 is the smallest quantity allowed (AC3) |

**Expected Result:**
- Each refused row shows one red message and keeps what you typed.
- Nothing is added for a refused row. Only the last two rows add a line: PA speaker
  (with its 500-character notes) and Presentation laptop.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7e4ed7d`, run in Chrome via Playwright for JameszLau (11/11 checks)

**Screenshots:** [refused-1-ac2](../screenshots/2026-10-03_TC-EQUIP-002_refused-1-ac2.jpg) · [refused-4-ac3](../screenshots/2026-10-03_TC-EQUIP-002_refused-4-ac3.jpg) · [refused-6-ac5](../screenshots/2026-10-03_TC-EQUIP-002_refused-6-ac5.jpg) · [accepted-pa-speaker-and-laptop](../screenshots/2026-10-03_TC-EQUIP-002_accepted-pa-speaker-and-laptop.jpg)

---

### TC-EQUIP-012: Changing an unreserved line, saving a reserved one unchanged, and removing an unreserved one (AC7, AC9, AC10)

**Preconditions:** As TC-EQUIP-002.

**Steps:**
1. On **Wireless microphone** (not reserved), press **Edit**, change the quantity to
   `5`, press **Save changes**.
2. On **Projector** (reserved), press **Edit**, change nothing, press **Save changes**.
3. On **Wireless microphone**, press **Remove**, then **Remove line**.

**Expected Result:**
- Step 1: it shows *Requested 5*, with **no** "Needs re-check" badge, and no warning
  was shown before saving (AC7).
- Step 2: the Projector is **not** put under review: no "Needs re-check" badge (AC9). A
  warning is shown, because the line is reserved (see TC-EQUIP-013).
- Step 3: the line disappears from the event (AC10).
- Signed in as `support@test.com`, `/staff/technical` says *Nothing needs your attention.*
  after these three steps: the only line left, the Projector, is reserved and unchanged.
  (Before step 3 the event was listed, its unreserved microphone being **New**.)

**Status:** [ ] Pass [ ] Fail


---

### TC-EQUIP-013: A reserved line changed by the coordinator reaches Technical Support (AC1, AC8, AC12, AC15)

This is the end-to-end case across both roles.

**Preconditions:** As TC-EQUIP-012. Signed in as `coordinator@test.com`.

**Steps:**
1. On **Projector** (Requested 2, Reserved 2), press **Edit**.
2. Read the panel before changing anything.
3. Change the quantity to `3` and press **Save changes**.
4. Sign out, sign in as `support@test.com`, open `/staff/technical`, then open
   *Founders' Gala Dinner*.

**Expected Result:**
- Step 2: a warning reads *Technical Support Staff will be asked to re-check this
  line* and says the reserved equipment stays held (AC12).
- Step 3: the line shows *Requested 3 · Reserved 2*, with the **Reserved** and
  **Needs re-check** badges. The reserved quantity did not change (AC8).
- Step 4: **Needs review** lists *Founders' Gala Dinner* (with its date) as *1 line of 1
  needs attention*. Its page shows *Projector*, Requested **3** (*was 2*), Reserved **2**,
  marked **Changed** (AC15).
- In the database, the Projector's `line_state` is now `Under review` and its
  `quantity_reserved` is still `2` (query in TC-EQUIP-009).

**Status:** [ ] Pass [ ] Fail


---

### TC-EQUIP-014: Removing a reserved line asks Technical Support to release it, and can be undone (AC11, AC12, AC15, AC17)

**Preconditions:** As TC-EQUIP-013. Signed in as `coordinator@test.com`.

**Steps:**
1. On **Projector**, press **Remove**.
2. Read the panel, then press **Request removal**.
3. Look at the Projector line. Try to find an **Edit** or **Remove** button on it.
4. Sign in as `support@test.com`, open `/staff/technical` and open *Founders' Gala Dinner*.
5. Sign in as `coordinator@test.com` again. On Projector, press **Undo removal**.
6. Sign in as `support@test.com`, open `/staff/technical` and open *Founders' Gala Dinner*.

**Expected Result:**
- Step 2: the panel warns that Technical Support will re-check the line, that it is
  not deleted, and that the equipment stays held until they release it (AC12).
- Step 3: the line stays, with **Reserved**, **Needs re-check** and **Removal
  requested** badges and *Reserved 2*. Only **Undo removal** is offered: no Edit or
  Remove (AC11, AC17).
- Step 4: the event is listed, and its page shows Projector marked **Removal requested** (AC15).
- Step 5: the line is kept, **Removal requested** is gone, **Needs re-check** and
  *Reserved 2* remain, and Edit and Remove are offered again (AC17). It stays flagged because
  the quantity was also changed to 3 in TC-EQUIP-013, so it still differs from what Technical
  Support reserved against. TC-EQUIP-017 covers a line with no other change.
- Step 6: the event is still listed, and its page shows Projector marked **Changed**, not
  Removal requested (AC15, AC17).
- In the database, after step 2 and again after step 5, the Projector's `line_state`
  is `Under review`: undoing the removal does not put it back to `Reserved`.

**Status:** [ ] Pass [ ] Fail


---

### TC-EQUIP-006: A Completed or Cancelled event's equipment is read-only (AC13)

**Preconditions:** Signed in as `coordinator@test.com`.

**Steps:**
1. Complete the event:
   ```sql
   update event set status = 'Completed' where name = 'Founders'' Gala Dinner';
   ```
2. Reload the Founders' Gala Dinner page.
3. Repeat with `'Cancelled'`.
4. Put it back:
   ```sql
   update event set status = 'Planning' where name = 'Founders'' Gala Dinner';
   ```

**Expected Result:**
- Steps 2 and 3: the page shows a **Read-only** notice naming the status. The lines
  are still listed, but there are no **Edit**, **Remove** or **Undo removal**
  buttons and no **Add equipment** form.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7e4ed7d`, run in Chrome via Playwright for JameszLau (6/6 checks)

**Screenshots:** [read-only-completed](../screenshots/2026-10-03_TC-EQUIP-006_read-only-completed.jpg) · [read-only-cancelled](../screenshots/2026-10-03_TC-EQUIP-006_read-only-cancelled.jpg)

---

### TC-EQUIP-007: A coordinator the event is not assigned to cannot see or change it (AC14)

**Preconditions:** Signed in as `coordinator@test.com`.

**Steps:**
1. Unassign the event:
   ```sql
   update event set assigned_coordinator_user_account_id = null where name = 'Founders'' Gala Dinner';
   ```
2. Open `/staff/coordinator/events/<id>` for the Founders' Gala Dinner.
3. Put it back:
   ```sql
   update event set assigned_coordinator_user_account_id =
     (select user_account_id from user_account where name = 'Test Coordinator')
   where name = 'Founders'' Gala Dinner';
   ```

**Expected Result:**
- Step 2: the access-denied screen (*You don’t have access to this page.*, Network
  tab **403**), exactly as for an event that does not exist: open
  `/staff/coordinator/events/999999` and compare. No equipment lines, no stated
  needs and no forms are shown.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7e4ed7d`, run in Chrome via Playwright for JameszLau (3/3 checks)

**Screenshots:** [step2-unassigned-event](../screenshots/2026-10-03_TC-EQUIP-007_step2-unassigned-event.jpg) · [compare-missing-event](../screenshots/2026-10-03_TC-EQUIP-007_compare-missing-event.jpg)

---

### TC-EQUIP-015: Only Technical Support Staff see the Needs review list (AC15, AC16)

**Preconditions:** At least one line is under review (after TC-EQUIP-013).

**Steps:**
1. Signed in as `support@test.com`, open `/staff/technical`.
2. Sign out. Signed in as `coordinator@test.com`, open `/staff/technical`.
3. Signed in as `venue@test.com`, open `/staff/technical`.

**Expected Result:**
- Step 1: **Needs review** is shown, read-only (no buttons on its rows).
- Steps 2 and 3: no list. Each shows the access-denied screen: the heading *You
  don’t have access to this page.* and *Please contact your respective Technical
  Support Staff.* The Network tab shows **403** for the page request (SPM-16).
- Neither screen shows any equipment, event or line.

**Status:** [ ] Pass [ ] Fail


---

### TC-EQUIP-009: The line's state and the audit trail are recorded (AC8, AC11, AC17, AC18)

Checks the database after TC-EQUIP-012 to TC-EQUIP-014, so run it straight after
them without re-seeding.

**Preconditions:** TC-EQUIP-001, 002, 012, 013 and 014 have been run in order.

**Steps:**
1. Read the lines of the event:
   ```sql
   select i.type, l.line_state, l.quantity_requested, l.quantity_reserved,
          l.removal_requested_at is not null as removal_requested
     from equipment_reservation_line l
     join equipment_item i using (equipment_item_id)
     join equipment_reservation r using (equipment_reservation_id)
     join event e on e.event_id = r.event_id
    where e.name = 'Founders'' Gala Dinner'
    order by i.type;
   ```
2. Read what was recorded about the changes:
   ```sql
   select a.action, u.name as actor, a.occurred_at
     from audit_record a
     left join user_account u on u.user_account_id = a.actor_user_account_id
     join equipment_reservation r on r.equipment_reservation_id = a.entity_id
     join event e on e.event_id = r.event_id
    where a.entity_type = 'equipment_reservation'
      and e.name = 'Founders'' Gala Dinner'
    order by a.occurred_at;
   ```

**Expected Result:**
- Step 1: **Projector** is `Under review` with `quantity_requested` 3 and
  `quantity_reserved` 2 (AC8, AC17). Lines nothing was reserved against, such as
  Livestream kit, are `Requested`. No line is `Reserved` and changed at the same
  time: a changed reserved line is always `Under review` (AC8).
- Step 2: one row for every add, edit, removal request, removal undone and delete
  made in the earlier cases, each with *Test Coordinator* as the actor (AC18). The
  removal request and the undo are their own rows (AC11, AC17).

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7e4ed7d`, run in Chrome via Playwright for JameszLau (9/9 checks)

**Screenshots:** 

---

### TC-EQUIP-016: Editing a line back to what Technical Support reserved clears the re-check (AC19, AC15)

Technical Support reserved the Projector against **Requested 2**. A change puts it under
review; changing it back to exactly that means there is nothing for them to re-check.

**Preconditions:** After TC-EQUIP-014, the Projector is *Requested 3 · Reserved 2*, still
**Needs re-check**, and on Technical Support's list. Signed in as `coordinator@test.com`.

**Steps:**
1. On **Projector**, press **Edit**, change the quantity to `1`, press **Save changes**.
2. Sign in as `support@test.com`, open `/staff/technical` and open *Founders' Gala Dinner*.
3. As the coordinator, edit the Projector to `3`.
4. As the coordinator, edit the Projector to `2` (what Technical Support reserved against).
5. As `support@test.com`, open `/staff/technical` again.
6. Check the database:
   ```sql
   select i.type, l.line_state, l.quantity_requested, l.quantity_reserved,
          l.reviewed_quantity_requested
     from equipment_reservation_line l
     join equipment_item i using (equipment_item_id)
    where i.type = 'Projector';
   ```

**Expected Result:**
- Step 1: the line shows *Requested 1 · Reserved 2*, still with **Needs re-check**.
- Step 2: the event is listed, and its page shows Projector, Requested **1** (*was 2*),
  Reserved **2**, marked **Changed**.
- Step 3: *Requested 3 · Reserved 2*, still **Needs re-check**: 3 is not what was reserved
  against, so it keeps being compared with 2 (AC19).
- Step 4: the line shows *Requested 2 · Reserved 2* with the **Reserved** badge only, and no
  **Needs re-check** (AC19). It is back to normal: Edit and Remove are offered.
- Step 5: the list says *Nothing needs your attention.* (AC15, AC19).
- Step 6: `line_state` is `Reserved`, `quantity_requested` and `quantity_reserved` are both `2`,
  and `reviewed_quantity_requested` is empty.

**Status:** [ ] Pass [ ] Fail


---

### TC-EQUIP-017: Withdrawing a removal request clears the re-check when nothing else differs (AC17, AC15)

**Preconditions:** After TC-EQUIP-016, the Projector is *Requested 2 · Reserved 2* with no
badge besides **Reserved**: nothing differs from what Technical Support reserved against.
Signed in as `coordinator@test.com`.

**Steps:**
1. On **Projector**, press **Remove**, read the panel, then press **Request removal**.
2. Sign in as `support@test.com`, open `/staff/technical` and open *Founders' Gala Dinner*.
3. As the coordinator, press **Undo removal** on the Projector.
4. As `support@test.com`, open `/staff/technical` again.
5. Check the database:
   ```sql
   select i.type, l.line_state, l.reviewed_quantity_requested,
          l.removal_requested_at is not null as removal_requested
     from equipment_reservation_line l
     join equipment_item i using (equipment_item_id)
    where i.type = 'Projector';
   ```

**Expected Result:**
- Step 1: the panel says the request can be undone until Technical Support release the
  equipment. The line then shows **Reserved**, **Needs re-check** and **Removal requested**,
  with only **Undo removal** offered.
- Step 2: the event is listed, and its page shows Projector, Requested **2**, Reserved **2**,
  marked **Removal requested**.
- Step 3: the line shows *Requested 2 · Reserved 2* with the **Reserved** badge only: **Removal
  requested** and **Needs re-check** are both gone, and Edit and Remove are offered again (AC17).
- Step 4: the list says *Nothing needs your attention.* The request is no longer valid (AC15).
- Step 5: `line_state` is `Reserved`, `reviewed_quantity_requested` is empty, and
  `removal_requested` is `false`.

**Status:** [ ] Pass [ ] Fail

