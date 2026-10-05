# Venue Unavailability Manual Tests (SPM-21)

## Overview

Browser checks for **SPM-21: Mark a venue unavailable**, run against the real app
and database. The rules behind the screens are unit-tested (tagged `SPM-265` to
`SPM-270`); these cases cover what a unit test cannot: that the page shows the
right thing, that a coordinator really is refused a blocked slot, that venue
search leaves a blocked venue out, and that the database refuses what it should.

Venue Staff block a venue for a date range and some slots (AM, PM, Night), with a
reason. Existing bookings are left alone and shown to the Venue Staff member. A
coordinator cannot request a blocked slot, and venue search treats it as taken. A
block can be lifted early and stays on record as Lifted.

The cases are specified in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-VBLOCK-001` to `TC-VBLOCK-008`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI
records it in `manual-runs.csv` when the PR merges, so do not edit that file. The
ticked boxes and screenshots below are the working record for this run.

**Last run:** all eight cases passed on 2026-10-05 at commit `68400f7`. A browser
script drove TC-VBLOCK-001 to 007 and checked each expected result, and
`checks.sql` ran TC-VBLOCK-008. The screenshots are in [`../screenshots/`](../screenshots/).

**Run the cases in order**, or re-seed (below) between them: TC-VBLOCK-004 to 006
build on the Studio block from TC-VBLOCK-001.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, rebuilt from every migration (`20261007*` adds the block tables,
  functions and booking trigger), then the three seeds:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  ```
- `pnpm dev:local`
- Approve the **Venue Safety Review** request once as `coordinator@test.com`: open
  *My requests*, then the request, then **Approve**. That opens its event, and
  `/staff/coordinator/4/venue-booking` is the page TC-VBLOCK-004 and 006 use.

Do **not** run `scripts/seed-venue-unavailability/seed.sql` first: it adds blocks on
Main Hall and Studio that these cases would then overlap. It is for trying the page
by hand (`scripts/README.md`).

### Test accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Used for |
| --- | --- | --- |
| `venue@test.com` | Venue Staff | Recording and lifting blocks |
| `coordinator@test.com` | Event Coordinator | Requesting a venue, searching, being refused |
| `support@test.com` | Technical Support Staff | Being refused the page (TC-VBLOCK-007) |

### The seeded data

| Venue | Where it comes from | Used for |
| --- | --- | --- |
| Studio, Rooftop Terrace | `seed-venues` | Blocks and booking requests. They have no slots or booking horizon recorded, so venue search never lists them |
| UAT-44 Harbour Room | `seed-venue-search-uat` | A Confirmed booking, *UAT-44 Booked Harbour*, on **D** PM |
| UAT-44 Garden Hall | `seed-venue-search-uat` | The venue venue search lists, for TC-VBLOCK-005 |

**D** is 14 days from today, Singapore time (2026-10-19 on the run date). The cases
below give the dates used on that run; shift them to match your own D.

---

## Test Cases

### TC-VBLOCK-001: Record a block and see it In force (AC1)

**Preconditions:** Signed in as `venue@test.com`; **Unavailability** in the sidebar.

**Steps:**
1. Choose **Studio**, From `2026-10-26`, To `2026-10-30`, tick **AM**, Reason **Renovation**.
2. Press **Mark unavailable**.
3. Count the stored records:
   ```sql
   select count(*) from venue_unavailability_slot s
     join venue_unavailability u using (venue_unavailability_id)
     join venue v on v.venue_id = u.venue_id
    where v.location = 'Studio' and u.reason_category = 'Renovation';
   ```

**Expected Result:**
- The block saves and is listed: Studio, 2026-10-26 to 2026-10-30, AM, Renovation, **In force**, recorded by Test Venue Staff with the time.
- The page says *No bookings are affected.*
- The count is **5**: one record per date and slot.

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step1-form-filled](../screenshots/2026-10-05_TC-VBLOCK-001_step1-form-filled.png) · [step2-saved-in-force](../screenshots/2026-10-05_TC-VBLOCK-001_step2-saved-in-force.png)

---

### TC-VBLOCK-002: The form refuses what the rules refuse (AC3 to AC8)

**Preconditions:** As TC-VBLOCK-001.

**Steps:** On **Rooftop Terrace**, try each row and note the outcome:

| From | To | Slots | Reason | Note | Expected |
| --- | --- | --- | --- | --- | --- |
| 2026-11-10 | 2026-11-09 | AM | Maintenance | — | Refused: the end date is before the start date (AC4) |
| 2026-10-04 | 2026-10-04 | AM | Maintenance | — | Refused: a block cannot end in the past (AC5) |
| 2026-11-12 | 2026-11-12 | AM | Other | 501 characters | Refused: at most 500 characters (AC8) |
| 2026-11-13 | 2026-11-13 | *(none)* | Maintenance | — | **Mark unavailable** stays disabled (AC3) |
| 2026-11-10 | 2026-11-10 | PM | Maintenance | — | **Accepted**: one day (AC4) |
| today | today | Night | Equipment failure | — | **Accepted**: ends today (AC5) |
| 2026-11-11 | 2026-11-11 | AM | Other | exactly 500 characters | **Accepted** (AC8) |

Then choose **Safety**: the **Note** box is not offered (AC7).

A reason outside the five and a note under a reason other than Other cannot be
sent from the page. They are checked in the database:
```bash
supabase db query --file scripts/seed-venue-unavailability/refusals.sql --local
```

**Expected Result:**
- Each refused row shows one red message and saves nothing; the accepted rows save.
- `refusals.sql` ends with *ok: all refusals held (rolled back on purpose)* (AC6, AC7, AC8).

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (8/8 checks). `refusals.sql` ended with "ok: all refusals held"

**Screenshots:** [step1-end-before-start-refused](../screenshots/2026-10-05_TC-VBLOCK-002_step1-end-before-start-refused.png) · [step2-ended-yesterday-refused](../screenshots/2026-10-05_TC-VBLOCK-002_step2-ended-yesterday-refused.png) · [step3-501-character-note-refused](../screenshots/2026-10-05_TC-VBLOCK-002_step3-501-character-note-refused.png) · [step4-no-slot-button-disabled](../screenshots/2026-10-05_TC-VBLOCK-002_step4-no-slot-button-disabled.png) · [step5-one-day-block-saved](../screenshots/2026-10-05_TC-VBLOCK-002_step5-one-day-block-saved.png) · [step6-ends-today-saved](../screenshots/2026-10-05_TC-VBLOCK-002_step6-ends-today-saved.png) · [step7-500-character-note-saved](../screenshots/2026-10-05_TC-VBLOCK-002_step7-500-character-note-saved.png) · [step8-no-note-box-under-safety](../screenshots/2026-10-05_TC-VBLOCK-002_step8-no-note-box-under-safety.png)

---

### TC-VBLOCK-003: Block a booked date and see what it overlaps (AC10, AC11)

**Preconditions:** As TC-VBLOCK-001. *UAT-44 Booked Harbour* is Confirmed at UAT-44 Harbour Room on D PM.

**Steps:**
1. Choose **UAT-44 Harbour Room**, From and To `2026-10-19`, tick **PM**, Reason **Safety**, press **Mark unavailable**.
2. Read **Bookings this block overlaps**.
3. Check the booking and its event:
   ```sql
   select b.status as booking_status, e.status as event_status
     from booking b join event e using (event_id)
    where e.name = 'UAT-44 Booked Harbour';
   ```

**Expected Result:**
- The block saves (AC10).
- The card lists *UAT-44 Booked Harbour · 2026-10-19 PM · Confirmed* and says the bookings and their events are unchanged (AC11).
- The booking is still `Confirmed` and the event still `Planning` (AC10).

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (3/3 checks)

**Screenshots:** [step1-affected-bookings-listed](../screenshots/2026-10-05_TC-VBLOCK-003_step1-affected-bookings-listed.png)

---

### TC-VBLOCK-004: A coordinator cannot request a blocked slot (AC12, AC13)

**Preconditions:** TC-VBLOCK-001 has run, so Studio is blocked for AM on 2026-10-26 to 2026-10-30. Signed in as `coordinator@test.com`; open `/staff/coordinator/4/venue-booking`.

**Steps:**
1. Choose **Studio**, date `2026-10-26`, tick **AM**, press **Send booking request**.
2. Choose **Studio**, date `2026-10-26`, tick **PM**, send.
3. Choose **Studio**, date `2026-10-31`, tick **AM**, send.

**Expected Result:**
- Step 1: refused with *The venue is unavailable for 2026-10-26 AM. Choose other slots or another venue.* and nothing is requested (AC12). There is no way to override it.
- Step 2: accepted, a different slot on the blocked day (AC13).
- Step 3: accepted, the day after the block ends (AC13).

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (3/3 checks)

**Screenshots:** [step1-refused-naming-date-and-slot](../screenshots/2026-10-05_TC-VBLOCK-004_step1-refused-naming-date-and-slot.png) · [step2-another-slot-accepted](../screenshots/2026-10-05_TC-VBLOCK-004_step2-another-slot-accepted.png) · [step3-day-after-accepted](../screenshots/2026-10-05_TC-VBLOCK-004_step3-day-after-accepted.png)

---

### TC-VBLOCK-005: Venue search leaves a blocked venue out (AC14)

**Preconditions:** Venue search lists only venues with slots and a booking horizon, so this case uses **UAT-44 Garden Hall**. As `venue@test.com`, block it for **AM** on `2026-10-21` (Reason **Equipment failure**). Then sign in as `coordinator@test.com` and open **Find a venue**.

**Steps:**
1. Search date `2026-10-21`, tick **AM**, press **Search**.
2. Search date `2026-10-21`, tick **PM**, press **Search**.

**Expected Result:**
- Step 1: **UAT-44 Garden Hall** is not listed; UAT-44 Harbour Room is. The summary counts a venue not shown because it is already booked in a slot chosen (AC14).
- Step 2: both venues are listed: the block does not cover PM.

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (3/3 checks)

**Screenshots:** [step1-blocked-venue-left-out](../screenshots/2026-10-05_TC-VBLOCK-005_step1-blocked-venue-left-out.png) · [step2-other-slot-both-listed](../screenshots/2026-10-05_TC-VBLOCK-005_step2-other-slot-both-listed.png)

---

### TC-VBLOCK-006: Lift a block, overlap, and history (AC15, AC16, AC17, AC19)

**Preconditions:** TC-VBLOCK-001 and TC-VBLOCK-004 have run.

**Steps:**
1. As `venue@test.com`, block **Studio** for **AM** on `2026-10-26` to `2026-10-27`, Reason **Safety**. It overlaps the Renovation block.
2. On the **Studio Renovation** row, press **Lift**, then reload.
3. As `coordinator@test.com`, request **Studio** on `2026-10-26` AM.
4. Request **Studio** on `2026-10-28` AM.

**Expected Result:**
- Step 1: the second block saves although it covers the same slots (AC19).
- Step 2: the Renovation row shows **Lifted**, with who lifted it and when, and has **no Lift button**. It stays in the list (AC16, AC17).
- Step 3: refused, naming 2026-10-26 AM: the Safety block still covers it (AC15).
- Step 4: accepted: only the lifted block covered it (AC15).

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (5/5 checks)

**Screenshots:** [step1-block-lifted-and-second-in-force](../screenshots/2026-10-05_TC-VBLOCK-006_step1-block-lifted-and-second-in-force.png) · [step2-still-refused-covered-by-second-block](../screenshots/2026-10-05_TC-VBLOCK-006_step2-still-refused-covered-by-second-block.png) · [step3-freed-slot-accepted](../screenshots/2026-10-05_TC-VBLOCK-006_step3-freed-slot-accepted.png)

---

### TC-VBLOCK-007: Only Venue Staff can open the page (AC9)

**Steps:** Sign in as each account in turn and open `/staff/venue/unavailability` directly:
1. `coordinator@test.com`
2. `support@test.com`

**Expected Result:**
- Each shows *You don’t have access to this page.* with a **403** for the page request (SPM-16), and none of the blocks or the form.

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step-coordinator-access-denied](../screenshots/2026-10-05_TC-VBLOCK-007_step-coordinator-access-denied.png) · [step-technical-support-access-denied](../screenshots/2026-10-05_TC-VBLOCK-007_step-technical-support-access-denied.png)

---

### TC-VBLOCK-008: Audit rows and the database refusals (AC9, AC12, AC18)

**Preconditions:** TC-VBLOCK-001 to 007 have run, then:

**Steps:**
1. Count the audit rows against the blocks:
   ```sql
   select action, count(*) from audit_record
    where entity_type = 'venue_unavailability' group by action;
   select count(*) as blocks, count(lifted_at) as lifted from venue_unavailability;
   ```
2. Run the database checks (they roll back, so nothing is left behind):
   ```bash
   supabase db query --file scripts/seed-venue-unavailability/checks.sql --local
   ```

**Expected Result:**
- Step 1: one `recorded` row per block and one `lifted` row per lifted block (AC18). On the run date: 7 recorded, 1 lifted, for 7 blocks and 1 lifted.
- Step 2: ends with *ok: all 19 checks held*. They cover a non-Venue-Staff session being refused on record, lift, list and affected bookings (AC9), the audit rows, the busy-time read, a booking slot inserted into a blocked slot being refused with `CS028` naming the date and slot (AC12), and lifting twice being refused.

**Status:** [x] Pass [ ] Fail — 2026-10-05, commit `68400f7`, run in Chrome via Playwright by Claude Code for JameszLau (2/2 checks). `checks.sql` ended with "ok: all 19 checks held"

**Screenshots:** none (database checks)
