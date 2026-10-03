# Equipment Requirements Manual Tests (SPM-41)

## Overview

Browser checks for **SPM-41: Specify equipment requirements for an event**, run
against the real app and database. The rules behind the screens are unit-tested
(tagged `SPM-182` to `SPM-187`); these cases cover what a unit test cannot: that
the pages show the right thing, that the warning appears before a reserved line is
saved, and that a change made by the coordinator reaches Technical Support.

The cases are registered as `MT-0035`–`MT-0042` in
[`../tests/test-registry.csv`](../tests/test-registry.csv). When you run them, tick
the boxes below **and** set `Status`, `ExecutedBy` and `LastPassedDate` on the
matching rows. CI cannot verify a manual case for you.

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

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

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
- Step 2: the "not found" page, exactly as for an event that does not exist. No
  equipment lines, no stated needs and no forms are shown.

**Status:** [ ] Pass [ ] Fail

---

### TC-EQUIP-008: Only Technical Support Staff see the "Needs re-check" list (AC15, AC16)

**Preconditions:** At least one line is under review (after TC-EQUIP-004).

**Steps:**
1. Signed in as `support@test.com`, open `/staff/technical`.
2. Sign out. Signed in as `coordinator@test.com`, open `/staff/technical`.
3. Signed in as `venue@test.com`, open `/staff/technical`.

**Expected Result:**
- Step 1: **Needs re-check** is shown, read-only (no buttons on its rows).
- Steps 2 and 3: no list. The page is refused: the "not found" page on this branch,
  and the access-denied screen with a 403 once SPM-16's change is in the branch.

**Status:** [ ] Pass [ ] Fail
