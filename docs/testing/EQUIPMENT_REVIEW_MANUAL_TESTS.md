# Equipment Review Manual Tests (SPM-273)

## Overview

Browser checks for **SPM-273: See equipment needing attention**. Technical Support
Staff's `/staff/technical` (**Needs review**) lists every active event — Planning,
Blocked or Confirmed — with at least one equipment line that is **new** (nothing
reserved yet), **changed** after it was reserved, or has its **removal requested**.
Opening an event shows all its lines, each marked, with how many units are free on
the event's date. **Reviewed** and **Archive** list the other events with equipment.

Units free on a date: the number owned, less what other active events hold.
Equipment is collected the day before an event and is free again the day after it
is returned, the return day being the event's date
([#5](https://github.com/SinYang13/IS212-2026/discussions/5),
[#113](https://github.com/SinYang13/IS212-2026/discussions/113)) — so events one day
either side count.

What SPM-273 does **not** cover, so is not tested here:

- **Acting on a line**: reserving is SPM-274; releasing or replacing is SPM-108.
- **Being notified** of a new or changed line: SPM-64.
- **Units out of service** reducing the count: SPM-17.
- **The coordinator's side** of changing and removing lines: SPM-41
  ([`EQUIPMENT_MANUAL_TESTS.md`](EQUIPMENT_MANUAL_TESTS.md)), whose TC-EQUIP-012 to 017
  read this list (they replace the retired TC-EQUIP-003, 004, 005, 008, 010 and 011).

The rules are unit-tested (`attentionReason`, `reservedAs`, `isActiveEvent`,
`equipmentQueueOf`, `holdsOverlap`, `unitsAvailable`, `ListEquipmentQueueUseCase` and
`ViewEventEquipmentForTechnicalSupportUseCase`, all tagged SPM-273), including every
event status, every line state and the day boundaries either side of the window.
These cases check the same rules end to end, through the real login, the
`technical_support_equipment_events` and `technical_support_event_equipment`
functions, and the pages.

These cases are registered as `TC-EQUIPREVIEW-001`–`TC-EQUIPREVIEW-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them,
tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the migration and the seeded accounts exist, then the
  SPM-273 seed:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-equipment-review/seed.sql --local
  supabase db query --file scripts/seed-equipment-review/verify.sql --local
  ```
  `verify.sql` should show 26 rows, all `ok = t`.
- `pnpm dev:local`
- Signed in as `support@test.com` (password `TestPass123!`).

TC-EQUIPREVIEW-004 needs no equipment at all: run it on a freshly reset database,
before the seed, or after `scripts/seed-equipment-review/teardown.sql`.

### The seeded events

| Event | Date | Status | Lines | List |
| --- | --- | --- | --- | --- |
| Tech Summit Keynote | 2026-11-15 | Planning | Projector 4 (none reserved) · Wireless microphone 6, reserved 4, was 4 · PA speaker 2, reserved 2, removal requested | Needs review |
| Alumni Networking Night | 2026-12-03 | Blocked | Livestream kit 1 (none reserved) | Needs review |
| Partner Roadshow | no date | Confirmed | Projector 2 (none reserved) | Needs review |
| Product Launch Rehearsal | 2026-11-14 | Planning | Projector 3/3 | Reviewed |
| Board Strategy Day | 2026-11-15 | Confirmed | Projector 2/2 · Wireless microphone 2/2 | Reviewed |
| Charity Gala Setup | 2026-11-16 | Blocked | Projector 1/1 | Reviewed |
| Year-End Town Hall | 2026-11-17 | Planning | Projector 5/5 | Reviewed |
| Autumn Workshop | 2026-11-15 | Cancelled | Projector 4/4 · Livestream kit 1 (none reserved) | Archive |
| Spring Conference | 2026-09-20 | Completed | Wireless microphone 2/2 | Archive |

Owned: Projector 10, Wireless microphone 30, PA speaker 5, Livestream kit 2. These are
four of the six equipment types of the Connectsphere Data Single Source of Truth, with
the same counts `seed-equipment` gives them, so either seed can be loaded first. The
events belong to both test coordinators.

---

## Test Cases

### TC-EQUIPREVIEW-001: Needs review lists every active event with a line needing attention (AC1, AC2)

**Preconditions:** Seeded as above.

**Steps:**
1. Open `/staff/technical`.
2. Read the **Needs review** table.

**Expected Result:**
- Three rows, in this order, each with its name, date, status and count:
  - *Tech Summit Keynote* · 2026-11-15 · Planning · *3 lines of 3 need attention*
  - *Alumni Networking Night* · 2026-12-03 · Blocked · *1 line of 1 needs attention*
  - *Partner Roadshow* · No date yet · Confirmed · *1 line of 1 needs attention*
- Events from both coordinators and of every equipment type are listed (AC2).
- *Autumn Workshop* is **not** listed, although it has a line with nothing reserved:
  it is Cancelled (AC1). No Reviewed or Completed event is listed.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-EQUIPREVIEW-002: An event's lines are marked New, Changed or Removal requested (AC3)

**Preconditions:** As TC-EQUIPREVIEW-001.

**Steps:**
1. On **Needs review**, open *Tech Summit Keynote*.
2. Read the **Equipment lines** table.

**Expected Result:**
- Three lines, in alphabetical order of type, each with type, quantity requested,
  quantity reserved and technical requirements:
  - *PA speaker* · Requested **2** · Reserved **2** · None · **Removal requested**,
    with no *was* line (only the removal changed)
  - *Projector* · Requested **4** · Reserved **0** · *HDMI and USB-C* · **New**
  - *Wireless microphone* · Requested **6**, *was 4* · Reserved **4** · *Two on the
    stage*, *was: One on the stage* · **Changed**
- No Reserve, Mark unavailable, return date, technical-support or activity controls
  appear: the page is read-only.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-EQUIPREVIEW-003: Each line shows the units free on the event's date (AC4)

**Preconditions:** As TC-EQUIPREVIEW-001.

**Steps:**
1. Open *Tech Summit Keynote* and read the **Available** column.
2. Go back to **Needs review**, open *Partner Roadshow* and read **Available**.

**Expected Result:**
- Step 1:
  - *PA speaker* **5**: 5 owned; no other event holds one.
  - *Projector* **4**: 10 owned, less 3 (Product Launch Rehearsal, 14 Nov), 2
    (Board Strategy Day, 15 Nov) and 1 (Charity Gala Setup, 16 Nov). The 5 held on
    17 Nov and the 4 held by the Cancelled Autumn Workshop on 15 Nov do not count.
  - *Wireless microphone* **28**: 30 owned, less Board Strategy Day's 2. Spring
    Conference's 2 (September, Completed) do not count.
- Step 2: the line says *Event has no date yet* instead of a number.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-EQUIPREVIEW-004: An empty list says nothing needs attention (AC5)

**Preconditions:** A freshly reset database with no equipment lines (before the seed,
or after `teardown.sql`).

**Steps:**
1. Open `/staff/technical`.
2. Open **Reviewed**, then **Archive**.

**Expected Result:**
- Step 1: the card reads *Nothing needs your attention.* with no table.
- Step 2: *Nothing reviewed yet.* and *Nothing archived.*, with no table.
- The sidebar list is empty on each.

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick

---

### TC-EQUIPREVIEW-005: The sidebar and every Technical Support screen show real events only (AC6)

**Preconditions:** As TC-EQUIPREVIEW-001.

**Steps:**
1. On **Needs review**, compare the sidebar list with the table.
2. Open **Reviewed**; compare its sidebar list and table.
3. Open **Archive**; compare its sidebar list and table.
4. Open *Board Strategy Day* from Reviewed and check which sidebar list is open.

**Expected Result:**
- Step 1: the sidebar lists the same three events as the table, in the same order,
  each with its date, status and count.
- Step 2: *Product Launch Rehearsal*, *Board Strategy Day*, *Charity Gala Setup* and
  *Year-End Town Hall*, each *N lines, all reserved*, in the sidebar and the table.
- Step 3: *Spring Conference* and *Autumn Workshop*, in the sidebar and the table.
- Step 4: the page shows its two lines with no attention mark; the crumb and the open
  sidebar list are **Reviewed**.
- No screen shows a placeholder event, reservation or equipment item (such as the
  earlier wireframe's reservation ids or *Reserve* button).

**Status:** [x] Pass [ ] Fail — 7/10/2026, run by Jerrick
