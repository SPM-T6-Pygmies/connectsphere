# Venue Unavailability Manual Tests (SPM-21, SPM-321)

## Overview

Browser checks for **SPM-21: Mark a venue unavailable**, as changed by **SPM-321: Block a venue
for a date range and time of day**, run against the real app and database. The rules behind the
screens are unit-tested (tagged `SPM-265` to `SPM-270` and `SPM-321`); these cases cover what a
unit test cannot: that the page shows the right thing, that a coordinator really is refused a
blocked time, that venue search leaves a blocked venue out, and that the database refuses what
it should.

Venue Staff block a venue for a date range and a **start and end time** (on the 15-minute grid,
the same times on every day), with a reason. Only time the venue is open can be blocked: the form
lists the venue's opening hours and will not let closed time be picked, and the server and the
database refuse it too. Existing bookings are left alone and shown to the Venue Staff member. A
coordinator cannot request a time a block overlaps (bookings are still AM, PM and Night, so they
are compared by the hours they cover), and venue search treats it as taken. A block can be lifted
early and stays on record as Lifted.

The cases are specified in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-VBLOCK-001` to `TC-VBLOCK-011`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI records it
in `manual-runs.csv` when the PR merges, so do not edit that file. The ticked boxes and
screenshots below are the working record for this run.

**Last run:** all eleven cases passed on 2026-10-22. A browser script drove TC-VBLOCK-001 to 007
and 009 to 011 and checked each expected result, and `checks.sql` ran TC-VBLOCK-008. The
screenshots are in [`../screenshots/`](../screenshots/).

**Run the cases in order**, or re-seed (below) between them: TC-VBLOCK-004, 006 and 011 build on
the Studio block from TC-VBLOCK-001.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, rebuilt from every migration (`20261021020000` converts blocks to 15-minute
  slots and compares by time), then the three seeds:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  ```
- `pnpm dev:local`
- Approve the **Venue Safety Review** request once as `coordinator@test.com`: open *My requests*,
  then the request, then **Approve**. That opens its event, and
  `/staff/coordinator/4/venue-booking` is the page TC-VBLOCK-004 and 006 use.

Do **not** run `scripts/seed-venue-unavailability/seed.sql` first: it adds blocks on Main Hall and
Studio that these cases would then overlap. It is for trying the page by hand
(`scripts/README.md`).

### Test accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Used for |
| --- | --- | --- |
| `venue@test.com` | Venue Staff | Recording and lifting blocks |
| `coordinator@test.com` | Event Coordinator | Requesting a venue, searching, being refused |
| `support@test.com` | Technical Support Staff | Being refused the page (TC-VBLOCK-007) |

### The seeded data

| Venue | Where it comes from | Opening hours | Used for |
| --- | --- | --- | --- |
| Main Hall, Studio, Rooftop Terrace | `seed-venues` | 07:00–12:00, 13:00–18:00, 19:00–24:00 | Blocks and booking requests. They have no booking horizon recorded, so venue search never lists them |
| UAT-44 Harbour Room | `seed-venue-search-uat` | 07:00–12:00, 13:00–18:00, 19:00–24:00 | A Confirmed booking, *UAT-44 Booked Harbour*, on **D** PM (13:00 to 18:00) |
| UAT-44 Garden Hall | `seed-venue-search-uat` | 07:00–12:00, 13:00–18:00 | The venue venue search lists, for TC-VBLOCK-005 |

Every seeded venue is closed 12:00–13:00 and 18:00–19:00 (and, for Garden Hall, from 18:00).

### The dates used on this run

Today is **Thursday 2026-10-22** (Singapore). **D** is 14 days from today, **2026-11-05**. Every
date below is that run's exact date; if you run later, shift each by the same number of days (and
keep a weekday range such as 2026-11-02 to 2026-11-06 in the future).

---

## Test Cases

### TC-VBLOCK-001: Record a block by time and see it In force (SPM-321 AC1, AC2)

**Scenario:** Studio's mornings need refurbishing. Venue Staff take Studio out of use from 09:00 to
11:30 every weekday of the week of Monday 2026-11-02.

**Preconditions:** Signed in as `venue@test.com`; **Unavailability** in the sidebar.

**Steps:**
1. Choose **Studio**, From `2026-11-02`, To `2026-11-06`, Start time **09:00**, End time **11:30**, Reason **Renovation**.
2. Press **Mark unavailable**.
3. Count the stored records:
   ```sql
   select count(*) from venue_unavailability_slot s
     join venue_unavailability u using (venue_unavailability_id)
     join venue v on v.venue_id = u.venue_id
    where v.location = 'Studio' and u.reason_category = 'Renovation';
   ```

**Expected Result:**
- The block saves and is listed: Studio, 2026-11-02 to 2026-11-06, **09:00–11:30**, Renovation, **In force**, recorded by Test Venue Staff with the time.
- The page says *No bookings are affected.*
- The count is **50**: five days × ten quarter hours (codes 36 to 45 each day).

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step1-form-filled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-001_step1-form-filled.png) · [step2-saved-in-force](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-001_step2-saved-in-force.png)

---

### TC-VBLOCK-002: The form refuses what the rules refuse (SPM-321 AC2; SPM-21 AC4 to AC8)

**Scenario:** Venue Staff mistype or try things the rules do not allow, on Rooftop Terrace.

**Preconditions:** As TC-VBLOCK-001.

**Steps:** On **Rooftop Terrace**, try each row and note the outcome:

| From | To | Times | Reason | Note | Expected |
| --- | --- | --- | --- | --- | --- |
| 2026-11-10 | 2026-11-09 | 09:00–11:30 | Maintenance | — | Refused: the end date is before the start date (AC4) |
| 2026-10-21 | 2026-10-21 | 09:00–11:30 | Maintenance | — | Refused: *A block cannot end in the past (2026-10-21 11:30).* (AC5) |
| 2026-11-12 | 2026-11-12 | 09:00–11:30 | Other | 501 characters | Refused: at most 500 characters (AC8) |
| 2026-11-13 | 2026-11-13 | 09:00 to *(none)* | Maintenance | — | **Mark unavailable** stays disabled (AC3) |
| 2026-11-10 | 2026-11-10 | 13:00–18:00 | Maintenance | — | **Accepted**: one day (AC4) |
| today, 2026-10-22 | 2026-10-22 | 19:00–24:00 | Equipment failure | — | **Accepted**: a block ending tonight at midnight has not ended (AC5) |
| 2026-11-11 | 2026-11-11 | 09:00–11:30 | Other | exactly 500 characters | **Accepted** (AC8) |

Then choose **Safety**: the **Note** box is not offered (AC7).

A reason outside the five and a note under a reason other than Other cannot be sent from the page.
They are checked in the database:
```bash
supabase db query --file scripts/seed-venue-unavailability/refusals.sql --local
```

**Expected Result:**
- Each refused row shows one red message and saves nothing; the accepted rows save.
- `refusals.sql` ends with *ok: all refusals held (rolled back on purpose)* (AC6, AC7, AC8).

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (9/9 checks). `refusals.sql` ended with "ok: all refusals held"

**Screenshots:** [step1-end-date-before-start-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step1-end-date-before-start-refused.png) · [step2-ended-yesterday-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step2-ended-yesterday-refused.png) · [step3-501-character-note-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step3-501-character-note-refused.png) · [step4-no-end-time-button-disabled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step4-no-end-time-button-disabled.png) · [step5-one-day-block-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step5-one-day-block-saved.png) · [step6-ends-tonight-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step6-ends-tonight-saved.png) · [step7-500-character-note-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step7-500-character-note-saved.png) · [step8-no-note-box-under-safety](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step8-no-note-box-under-safety.png)

---

### TC-VBLOCK-003: Block a booked date and see what it overlaps (SPM-321 AC4; SPM-21 AC10)

**Scenario:** Harbour Room has a Confirmed booking, *UAT-44 Booked Harbour*, on D PM (13:00 to 18:00). Venue Staff need the room from 15:00 to 17:00 that day for a safety inspection.

**Preconditions:** As TC-VBLOCK-001.

**Steps:**
1. Choose **UAT-44 Harbour Room**, From and To `2026-11-05`, Start **15:00**, End **17:00**, Reason **Safety**, press **Mark unavailable**.
2. Read **Bookings this block overlaps**.
3. Check the booking and its event:
   ```sql
   select b.status as booking_status, e.status as event_status
     from booking b join event e using (event_id)
    where e.name = 'UAT-44 Booked Harbour';
   ```

**Expected Result:**
- The block saves (it does not need the booking to move).
- The card lists *UAT-44 Booked Harbour · 2026-11-05 13:00 to 18:00 · Confirmed*: the booking's days and hours, not the PM slot name, and says the bookings and their events are unchanged.
- The booking is still `Confirmed` and the event still `Planning`.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step1-form-filled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-003_step1-form-filled.png) · [step2-affected-bookings-listed](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-003_step2-affected-bookings-listed.png)

---

### TC-VBLOCK-004: A coordinator cannot request a blocked time (SPM-321 AC3)

**Scenario:** Studio is blocked 09:00 to 11:30 on Monday 2026-11-02 (TC-VBLOCK-001). The Coordinator tries to book Studio for the morning (AM is 07:00 to 12:00, so it overlaps the block), then for the afternoon, then for the weekend day after the block ends.

**Preconditions:** TC-VBLOCK-001 has run. Signed in as `coordinator@test.com`; open `/staff/coordinator/4/venue-booking`.

**Steps:**
1. Choose **Studio**, date `2026-11-02`, tick **AM**, press **Send booking request**.
2. Choose **Studio**, date `2026-11-02`, tick **PM**, send.
3. Choose **Studio**, date `2026-11-07`, tick **AM**, send.

**Expected Result:**
- Step 1: refused with *The venue is unavailable 2026-11-02 09:00 to 11:30. Choose other times or another venue.* and nothing is requested. It names the blocked times, not "AM". There is no way to override it.
- Step 2: accepted: PM (13:00 to 18:00) shares no time with the block.
- Step 3: accepted: the day after the block ends.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step1-refused-naming-date-and-slot](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step1-refused-naming-date-and-slot.png) · [step2-another-slot-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step2-another-slot-accepted.png) · [step3-day-after-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step3-day-after-accepted.png)

---

### TC-VBLOCK-005: Venue search leaves a blocked venue out (SPM-321 AC8; SPM-21 AC14)

**Scenario:** Garden Hall's projector is broken from 08:00 to 10:00 on Wednesday 2026-10-28. A Coordinator searching for a morning that day should not be offered it, but should still be offered it for the afternoon.

**Preconditions:** Venue search lists only venues with opening hours and a booking horizon, so this case uses **UAT-44 Garden Hall**. As `venue@test.com`, block it from **08:00** to **10:00** on `2026-10-28` (Reason **Equipment failure**). Then sign in as `coordinator@test.com` and open **Find a venue**.

**Steps:**
1. Search date `2026-10-28`, tick **AM**, press **Search**.
2. Search date `2026-10-28`, tick **PM**, press **Search**.

**Expected Result:**
- Step 1: **UAT-44 Garden Hall** is not listed; UAT-44 Harbour Room is. The summary counts a venue not shown because it is already booked in the time chosen.
- Step 2: both venues are listed: the block does not reach PM.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (3/3 checks)

**Screenshots:** [step1-blocked-venue-left-out](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-005_step1-blocked-venue-left-out.png) · [step2-other-slot-both-listed](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-005_step2-other-slot-both-listed.png)

---

### TC-VBLOCK-006: Lift a block, overlap, and history (SPM-321 AC5; SPM-21 AC15 to AC17, AC19)

**Scenario:** After TC-VBLOCK-001 Studio is blocked 09:00 to 11:30 (Renovation) from 2026-11-02 to 2026-11-06. Venue Staff add a Safety block over 10:00 to 12:00 on 2026-11-02 and 2026-11-03, then lift the Renovation block early. The Safety block must keep refusing the overlap, and the times only Renovation held must come free.

**Preconditions:** TC-VBLOCK-001 and TC-VBLOCK-004 have run.

**Steps:**
1. As `venue@test.com`, block **Studio** from `2026-11-02` to `2026-11-03`, Start **10:00**, End **12:00**, Reason **Safety**. It overlaps the Renovation block between 10:00 and 11:30.
2. On the **Studio Renovation** row, press **Lift**, then reload.
3. As `coordinator@test.com`, request **Studio** on `2026-11-03` AM.
4. Request **Studio** on `2026-11-04` AM.

**Expected Result:**
- Step 1: the second block saves although it covers some of the same time.
- Step 2: the Renovation row shows **Lifted**, with who lifted it and when, and has **no Lift button**. It stays in the list.
- Step 3: refused: *The venue is unavailable 2026-11-03 10:00 to 12:00. Choose other times or another venue.* The Safety block still covers it.
- Step 4: accepted: only the lifted block covered 2026-11-04.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step1-overlapping-block-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step1-overlapping-block-saved.png) · [step2-renovation-lifted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step2-renovation-lifted.png) · [step3-still-refused-covered-by-second-block](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step3-still-refused-covered-by-second-block.png) · [step4-freed-time-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step4-freed-time-accepted.png)

---

### TC-VBLOCK-007: Only Venue Staff can open the page (SPM-21 AC9)

**Steps:** Sign in as each account in turn and open `/staff/venue/unavailability` directly:
1. `coordinator@test.com`
2. `support@test.com`

**Expected Result:**
- Each shows *You don’t have access to this page.* with a **403** for the page request (SPM-16), and none of the blocks or the form.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (2/2 checks)

**Screenshots:** [step-coordinator-access-denied](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-007_step-coordinator-access-denied.png) · [step-technical-support-access-denied](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-007_step-technical-support-access-denied.png)

---

### TC-VBLOCK-008: Audit rows and the database refusals (SPM-321 AC3, AC7; SPM-21 AC9, AC18)

**Preconditions:** TC-VBLOCK-001 to 007, 009 and 010 have run, then:

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
- Step 1: one `recorded` row per block and one `lifted` row per lifted block. On the run date: 7 recorded, 1 lifted, for 7 blocks and 1 lifted.
- Step 2: ends with *ok: all 30 checks held*. They cover a non-Venue-Staff session being refused on record, lift, list and affected bookings, the audit rows, the busy-time read of 09:00 to 10:00, a booking slot whose hours a block reaches being refused with `CS028` while a slot it does not reach is accepted, a block touching only a quarter hour of AM refusing AM, a block that starts as AM ends not refusing it, approving, holding and confirming a hold over a block recorded later being refused, a block over the 12:00 to 13:00 lunch gap being refused with `CS078` and leaving nothing behind, the calendar read giving quarter hours in order, and lifting twice being refused.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (2/2 checks). `checks.sql` ended with "ok: all 30 checks held"

**Screenshots:** none (database checks)

---

### TC-VBLOCK-009: The form lists the opening hours and will not let closed time be picked (SPM-321 AC7)

**Scenario:** Main Hall is open 07:00–12:00, 13:00–18:00 and 19:00–24:00. Venue Staff choosing times for it should see those hours, be unable to pick time the hall is closed, and be unable to pick an end that would stretch over the lunch closure.

**Preconditions:** Signed in as `venue@test.com`; **Unavailability** open.

**Steps:**
1. Choose **Main Hall**. Read the line under the times.
2. Open the **Start time** list. Find 06:45, 12:00, 12:45 and 18:00, then 07:00, 11:45, 13:00 and 23:45.
3. Choose Start **09:00**, then open the **End time** list. Find 12:00, 12:15, 13:00 and 09:00.
4. Choose a different venue.

**Expected Result:**
- Step 1: *Opening hours: 07:00–12:00, 13:00–18:00, 19:00–24:00. A block can only cover time the venue is open.*
- Step 2: 06:45, 12:00, 12:45 and 18:00 are greyed and marked *(closed)* and cannot be picked; 07:00, 11:45, 13:00 and 23:45 can.
- Step 3: End 12:00 can be picked. 12:15 and 13:00 are greyed *(closed in between)*: a block from 09:00 cannot run past 12:00 without covering the closed hour. 09:00 is greyed *(not after the start)*.
- Step 4: the Start and End times are cleared, so closed time cannot be carried to a venue where it is open.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (7/7 checks)

**Screenshots:** [step2-start-times-closed-disabled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-009_step2-start-times-closed-disabled.png) · [step3-end-times-after-start-0900](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-009_step3-end-times-after-start-0900.png)

---

### TC-VBLOCK-010: A block over closed time is refused, naming it (SPM-321 AC7)

**Scenario:** Venue Staff A opens the form for UAT-44 Harbour Room and picks 09:00–11:30 on 2026-11-17. Before A saves, a colleague shortens the Harbour Room's morning hours to end at 11:00. A's page still shows 11:00–12:00 as open, but the server knows better.

**Preconditions:** Signed in as `venue@test.com`.

**Steps:**
1. Open the form, choose **UAT-44 Harbour Room**, From and To `2026-11-17`, Start **09:00**, End **11:30**, Reason **Maintenance**. Do not save yet.
2. In a second tab, as `venue@test.com`, open **Venues**, then **UAT-44 Harbour Room**, change the first opening window's **Closes** hour from 12 to **11** (minute 00) and press **Save venue**.
3. Back in the first tab press **Mark unavailable**.
4. Put the hours back: in the second tab set the first window's **Closes** hour back to **12** and press **Save venue**.

**Expected Result:**
- Step 3: refused with *The venue is closed 11:00–11:30, so it cannot be blocked then. Choose times within its opening hours (07:00–11:00, 13:00–18:00, 19:00–24:00).* The form still shows the venue and times chosen, and nothing is saved for 2026-11-17.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (5/5 checks), with the hours changed and restored through the venue form

**Screenshots:** [step1-form-filled-before-hours-change](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-010_step1-form-filled-before-hours-change.png) · [step2-refused-naming-the-closed-time](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-010_step2-refused-naming-the-closed-time.png)

---

### TC-VBLOCK-011: A block on part of a slot blocks that slot on the calendar (SPM-321 AC8)

**Scenario:** Studio is blocked 09:00 to 11:30 (Renovation) for the week of 2026-11-02. A Coordinator looking at Studio's calendar for that week should see the mornings as Blocked with the reason, and the afternoons and evenings as Available.

**Preconditions:** TC-VBLOCK-001 has run, and TC-VBLOCK-006 has not (it lifts the Renovation block). Signed in as `coordinator@test.com`.

**Steps:**
1. Open **Find a venue**, then Studio's calendar, and go to the week of Monday 2026-11-02 (or open the calendar with `?from=2026-11-02`).

**Expected Result:**
- Monday 2026-11-02 to Friday 2026-11-06: **AM** reads **Blocked** with *Renovation*. **PM** and **Night** read **Available** (the block does not reach them).

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright by Claude Code for JameszLau (1/1 check)

**Screenshots:** [step1-calendar-week-of-2026-11-02](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-011_step1-calendar-week-of-2026-11-02.png)
