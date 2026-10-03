# Equipment Requirements Manual Tests (SPM-41)

## Overview

Browser checks for **SPM-41: Specify equipment requirements for an event**, run
against the real app and database. The rules behind the screens are unit-tested
(tagged `SPM-182` to `SPM-187`); these cases cover what a unit test cannot: that
the pages show the right thing, that the warning appears before a reserved line is
saved, and that a change made by the coordinator reaches Technical Support.

A reserved line the coordinator changes, or asks to remove, goes from **Reserved**
to **Under review**: the screens show this as the **Needs re-check** badge, and it
is what puts the line on Technical Support's list. TC-EQUIP-009 checks the state
itself in the database. The access-denied screen in TC-EQUIP-008 comes from SPM-16
([`ACCESS_DENIED_MANUAL_TESTS.md`](ACCESS_DENIED_MANUAL_TESTS.md)).

The cases are registered as `MT-0035`–`MT-0043` in
[`../tests/test-registry.csv`](../tests/test-registry.csv). When you run them, tick
the boxes below **and** set `Status`, `ExecutedBy` and `LastPassedDate` on the
matching rows. CI cannot verify a manual case for you.

**Last run:** all nine cases passed on 3/10/2026 at commit `7afd371` (see each case's Status and
Screenshots). A browser script drove the cases and checked each expected result, including the
database checks; the screenshots are in [`../screenshots/`](../screenshots/).

**Run the cases in order**, or re-seed (below) between them: TC-EQUIP-004 changes
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
| `support@test.com` | Technical Support Staff | The "Needs re-check" list |
| `venue@test.com` | Venue Staff | Being refused the list (TC-EQUIP-008) |

### The seeded event

**Founders' Gala Dinner**, Planning, assigned to Test Coordinator. Open it from
`/staff/coordinator/events` (its page is `/staff/coordinator/events/<id>`). It has
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

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (8/8 checks)

**Screenshots:** [step1-organiser-needs-and-lines](../screenshots/SPM-41_TC-EQUIP-001_step1-organiser-needs-and-lines.jpg) · [step3-livestream-line-added](../screenshots/SPM-41_TC-EQUIP-001_step3-livestream-line-added.jpg)

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

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (11/11 checks)

**Screenshots:** [refused-1-ac2](../screenshots/SPM-41_TC-EQUIP-002_refused-1-ac2.jpg) · [refused-4-ac3](../screenshots/SPM-41_TC-EQUIP-002_refused-4-ac3.jpg) · [refused-6-ac5](../screenshots/SPM-41_TC-EQUIP-002_refused-6-ac5.jpg) · [accepted-pa-speaker-and-laptop](../screenshots/SPM-41_TC-EQUIP-002_accepted-pa-speaker-and-laptop.jpg)

---

### TC-EQUIP-003: Changing an unreserved line, saving a reserved one unchanged, and removing an unreserved one (AC7, AC9, AC10)

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
  warning is shown, because the line is reserved (see TC-EQUIP-004).
- Step 3: the line disappears from the event (AC10).
- Signed in as `support@test.com`, `/staff/technical` still says *Nothing needs
  re-checking.* after these three steps.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (6/6 checks)

**Screenshots:** [step1-microphone-5-no-badge](../screenshots/SPM-41_TC-EQUIP-003_step1-microphone-5-no-badge.jpg) · [step2-projector-saved-unchanged](../screenshots/SPM-41_TC-EQUIP-003_step2-projector-saved-unchanged.jpg) · [step3-microphone-removed](../screenshots/SPM-41_TC-EQUIP-003_step3-microphone-removed.jpg) · [step4-technical-support-list-empty](../screenshots/SPM-41_TC-EQUIP-003_step4-technical-support-list-empty.jpg)

---

### TC-EQUIP-004: A reserved line changed by the coordinator reaches Technical Support (AC1, AC8, AC12, AC15)

This is the end-to-end case across both roles.

**Preconditions:** As TC-EQUIP-003. Signed in as `coordinator@test.com`.

**Steps:**
1. On **Projector** (Requested 2, Reserved 2), press **Edit**.
2. Read the panel before changing anything.
3. Change the quantity to `3` and press **Save changes**.
4. Sign out, sign in as `support@test.com`, open `/staff/technical`.

**Expected Result:**
- Step 2: a warning reads *Technical Support Staff will be asked to re-check this
  line* and says the reserved equipment stays held (AC12).
- Step 3: the line shows *Requested 3 · Reserved 2*, with the **Reserved** and
  **Needs re-check** badges. The reserved quantity did not change (AC8).
- Step 4: **Needs re-check** lists *Founders' Gala Dinner* (with its date),
  *Projector*, Requested **3**, Reserved **2**, marked **Changed** (AC15).
- No other line is on the list.
- In the database, the Projector's `line_state` is now `Under review` and its
  `quantity_reserved` is still `2` (query in TC-EQUIP-009).

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (6/6 checks)

**Screenshots:** [step2-edit-warning](../screenshots/SPM-41_TC-EQUIP-004_step2-edit-warning.jpg) · [step3-projector-needs-recheck](../screenshots/SPM-41_TC-EQUIP-004_step3-projector-needs-recheck.jpg) · [step4-technical-support-list-changed](../screenshots/SPM-41_TC-EQUIP-004_step4-technical-support-list-changed.jpg)

---

### TC-EQUIP-005: Removing a reserved line asks Technical Support to release it, and can be undone (AC11, AC12, AC15, AC17)

**Preconditions:** As TC-EQUIP-004. Signed in as `coordinator@test.com`.

**Steps:**
1. On **Projector**, press **Remove**.
2. Read the panel, then press **Request removal**.
3. Look at the Projector line. Try to find an **Edit** or **Remove** button on it.
4. Sign in as `support@test.com` and open `/staff/technical`.
5. Sign in as `coordinator@test.com` again. On Projector, press **Undo removal**.
6. Sign in as `support@test.com` and open `/staff/technical`.

**Expected Result:**
- Step 2: the panel warns that Technical Support will re-check the line, that it is
  not deleted, and that the equipment stays held until they release it (AC12).
- Step 3: the line stays, with **Reserved**, **Needs re-check** and **Removal
  requested** badges and *Reserved 2*. Only **Undo removal** is offered: no Edit or
  Remove (AC11, AC17).
- Step 4: the list shows Projector marked **Removal requested** (AC15).
- Step 5: the line is kept, **Removal requested** is gone, **Needs re-check** and
  *Reserved 2* remain, and Edit and Remove are offered again (AC17).
- Step 6: the list shows Projector again, marked **Changed**, not Removal requested
  (AC15, AC17).
- In the database, after step 2 and again after step 5, the Projector's `line_state`
  is `Under review`: undoing the removal does not put it back to `Reserved`.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (9/9 checks)

**Screenshots:** [step2-remove-warning](../screenshots/SPM-41_TC-EQUIP-005_step2-remove-warning.jpg) · [step3-removal-requested](../screenshots/SPM-41_TC-EQUIP-005_step3-removal-requested.jpg) · [step4-technical-support-removal-requested](../screenshots/SPM-41_TC-EQUIP-005_step4-technical-support-removal-requested.jpg) · [step5-removal-undone](../screenshots/SPM-41_TC-EQUIP-005_step5-removal-undone.jpg) · [step6-technical-support-changed-again](../screenshots/SPM-41_TC-EQUIP-005_step6-technical-support-changed-again.jpg)

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

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (6/6 checks)

**Screenshots:** [read-only-completed](../screenshots/SPM-41_TC-EQUIP-006_read-only-completed.jpg) · [read-only-cancelled](../screenshots/SPM-41_TC-EQUIP-006_read-only-cancelled.jpg)

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

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (3/3 checks)

**Screenshots:** [step2-unassigned-event](../screenshots/SPM-41_TC-EQUIP-007_step2-unassigned-event.jpg) · [compare-missing-event](../screenshots/SPM-41_TC-EQUIP-007_compare-missing-event.jpg)

---

### TC-EQUIP-008: Only Technical Support Staff see the "Needs re-check" list (AC15, AC16)

**Preconditions:** At least one line is under review (after TC-EQUIP-004).

**Steps:**
1. Signed in as `support@test.com`, open `/staff/technical`.
2. Sign out. Signed in as `coordinator@test.com`, open `/staff/technical`.
3. Signed in as `venue@test.com`, open `/staff/technical`.

**Expected Result:**
- Step 1: **Needs re-check** is shown, read-only (no buttons on its rows).
- Steps 2 and 3: no list. Each shows the access-denied screen: the heading *You
  don’t have access to this page.* and *Please contact your respective Technical
  Support Staff.* The Network tab shows **403** for the page request (SPM-16).
- Neither screen shows any equipment, event or line.

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (8/8 checks)

**Screenshots:** [step1-technical-support-sees-list](../screenshots/SPM-41_TC-EQUIP-008_step1-technical-support-sees-list.jpg) · [step2-coordinator-access-denied](../screenshots/SPM-41_TC-EQUIP-008_step2-coordinator-access-denied.jpg) · [step3-venue-staff-access-denied](../screenshots/SPM-41_TC-EQUIP-008_step3-venue-staff-access-denied.jpg)

---

### TC-EQUIP-009: The line's state and the audit trail are recorded (AC8, AC11, AC17, AC18)

Checks the database after TC-EQUIP-003 to TC-EQUIP-005, so run it straight after
them without re-seeding.

**Preconditions:** TC-EQUIP-001 to TC-EQUIP-005 have been run in order.

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

**Status:** [x] Pass [ ] Fail — 3/10/2026, commit `7afd371`, run in Chrome via Playwright by Claude for JameszLau (9/9 checks)

**Screenshots:** 
