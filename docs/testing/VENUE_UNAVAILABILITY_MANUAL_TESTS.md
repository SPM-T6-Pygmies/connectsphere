# Venue Unavailability Manual Tests (SPM-21, SPM-321)

> **SPM-459:** the coordinator's *Request a venue* page is now the **Venue** tab of the
> event page, `/staff/coordinator/events/<event id>?tab=venue`. Where a case below says
> *Request a venue*, use that tab. *My events* → **Request a venue** opens it, and the old
> `/staff/coordinator/<request id>/venue-booking` URL redirects there.

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
`TC-VBLOCK-001` to `TC-VBLOCK-013`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI records it
in `manual-runs.csv` when the PR merges, so do not edit that file. The ticked boxes and
screenshots below are the working record for this run.

**Last run:** all thirteen cases passed on 2026-10-22. A browser script drove TC-VBLOCK-001 to 007,
009 to 012 and checked each expected result, `checks.sql` ran TC-VBLOCK-008, and TC-VBLOCK-013 was run by hand with SQL. The
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
| Main Hall, Studio, Rooftop Terrace | `seed-venues` | 07:00–24:00 | Blocks and booking requests. They have no booking horizon recorded, so venue search never lists them |
| UAT-44 Harbour Room | `seed-venue-search-uat` | 07:00–24:00 | TC-VBLOCK-010 and the venue search in TC-VBLOCK-005 |
| UAT-44 Garden Hall | `seed-venue-search-uat` | 07:00–18:00 | The venue venue search lists, for TC-VBLOCK-005 |

Every seeded venue is closed before 07:00, and Garden Hall from 18:00. A venue opens once a day,
with no break (SPM-320).

### The dates used on this run

Every date in these cases is fixed in **December 2026**, so the cases still work when they are run
late in November or in December: Monday 2026-12-14 to Friday 2026-12-18 (the Studio week),
Saturday 2026-12-19, Monday 2026-12-21 to Thursday 2026-12-24, Wednesday 2026-12-16 and Monday
2026-12-28. Two things are not fixed, on purpose: "yesterday" in TC-VBLOCK-002 is the fixed past date
2026-10-01, and the row that must end *tonight* uses **today's** date, because a block still in
progress can only be tested with the day it runs. The run recorded below was on Thursday 2026-10-22.

---

## Test Cases

### TC-VBLOCK-001: Record a block by time and see it In force (SPM-321 AC1, AC2)

**Scenario:** Studio's mornings need refurbishing. Venue Staff take Studio out of use from 09:00 to
11:30 every weekday of the week of Monday 2026-12-14.

**Preconditions:** Signed in as `venue@test.com`; **Unavailability** in the sidebar.

**Steps:**
1. Choose **Studio**, From `2026-12-14`, To `2026-12-18`, Start time **09:00**, End time **11:30**, Reason **Renovation**.
2. Press **Mark unavailable**.
3. Count the stored records:
   ```sql
   select count(*) from venue_unavailability_slot s
     join venue_unavailability u using (venue_unavailability_id)
     join venue v on v.venue_id = u.venue_id
    where v.location = 'Studio' and u.reason_category = 'Renovation';
   ```

**Expected Result:**
- The block saves and is listed: Studio, 2026-12-14 to 2026-12-18, **09:00–11:30**, Renovation, **In force**, recorded by Test Venue Staff with the time.
- The page says *No bookings are affected.*
- A green message says what was saved: *Saved. Studio is blocked 2026-12-14 to 2026-12-18, 09:00–11:30, for renovation. It is In force and listed below.*
- The form is empty again, with **Mark unavailable** disabled, so the block is not one click from being saved a second time.
- The count is **50**: five days × ten quarter hours (codes 36 to 45 each day).

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (6/6 checks)

**Screenshots:** [step1-form-filled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-001_step1-form-filled.png) · [step2-saved-in-force](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-001_step2-saved-in-force.png)

---

### TC-VBLOCK-002: The form refuses what the rules refuse (SPM-321 AC2; SPM-21 AC4 to AC8)

**Scenario:** Venue Staff mistype or try things the rules do not allow, on Rooftop Terrace.

**Preconditions:** As TC-VBLOCK-001.

**Steps:** On **Rooftop Terrace**, try each row and note the outcome:

| From | To | Times | Reason | Note | Expected |
| --- | --- | --- | --- | --- | --- |
| 2026-12-21 | 2026-12-20 | 09:00–11:30 | Maintenance | — | Refused: the end date is before the start date (AC4) |
| 2026-10-01 | 2026-10-01 | 09:00–11:30 | Maintenance | — | Refused: *A block cannot end in the past (2026-10-01 11:30).* (AC5) |
| 2026-12-23 | 2026-12-23 | 09:00–11:30 | Other | 501 characters | Refused: at most 500 characters (AC8) |
| 2026-12-24 | 2026-12-24 | 09:00 to *(none)* | Maintenance | — | **Mark unavailable** stays disabled (AC3) |
| 2026-12-21 | 2026-12-21 | 13:00–18:00 | Maintenance | — | **Accepted**: one day (AC4) |
| today, 2026-10-22 | 2026-10-22 | 19:00–24:00 | Equipment failure | — | **Accepted**: a block ending tonight at midnight has not ended (AC5) |
| 2026-12-22 | 2026-12-22 | 09:00–11:30 | Other | exactly 500 characters | **Accepted** (AC8) |

Then choose **Safety**: the **Note** box is not offered (AC7).

A reason outside the five and a note under a reason other than Other cannot be sent from the page.
They are checked in the database:
```bash
supabase db query --file scripts/seed-venue-unavailability/refusals.sql --local
```

**Expected Result:**
- Each refused row shows one red message and saves nothing; the accepted rows save.
- `refusals.sql` ends with *ok: all refusals held (rolled back on purpose)* (AC6, AC7, AC8).

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (9/9 checks). `refusals.sql` ended with "ok: all refusals held"

**Screenshots:** [step1-end-date-before-start-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step1-end-date-before-start-refused.png) · [step2-ended-yesterday-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step2-ended-yesterday-refused.png) · [step3-501-character-note-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step3-501-character-note-refused.png) · [step4-no-end-time-button-disabled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step4-no-end-time-button-disabled.png) · [step5-one-day-block-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step5-one-day-block-saved.png) · [step6-ends-tonight-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step6-ends-tonight-saved.png) · [step7-500-character-note-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step7-500-character-note-saved.png) · [step8-no-note-box-under-safety](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-002_step8-no-note-box-under-safety.png)

---

### TC-VBLOCK-003: Block a booked date and see what it overlaps (SPM-321 AC4; SPM-21 AC10)

**Scenario:** The Coordinator books Rooftop Terrace for the morning of Wednesday 2026-12-16, 07:00 to 12:00, and Venue Staff approve it, so it is Confirmed. Then Venue Staff need the terrace from 09:30 to 10:30 that day for a safety inspection. The block covers only part of the booking, and it must not move the booking.

**Preconditions:** The Venue Safety Review request approved once as `coordinator@test.com` (Setup). Signed in as `coordinator@test.com` first, then `venue@test.com`.

**Steps:**
1. As `coordinator@test.com` open `/staff/coordinator/4/venue-booking`, choose **Rooftop Terrace**, layout **Banquet**, date `2026-12-16`, Start **07:00**, End **12:00**, press **Send booking request**.
2. As `venue@test.com` open **Requests**, the **Rooftop Terrace** request for 2026-12-16 07:00–12:00, and press **Approve booking**. It reads *Confirmed*.
3. Open **Unavailability**. Choose **Rooftop Terrace**, From and To `2026-12-16`, Start **09:30**, End **10:30**, Reason **Safety**, press **Mark unavailable**.
4. Read **Bookings this block overlaps**.
5. Check the booking and its event:
   ```sql
   select b.status as booking_status, e.status as event_status
     from booking b join event e using (event_id)
     join booking_slot bs on bs.booking_id = b.booking_id
    where bs.slot_date = '2026-12-16' and b.venue_id = (select venue_id from venue where location = 'Rooftop Terrace');
   ```

**Expected Result:**
- Step 3: the block saves; it does not wait for the booking to move.
- Step 4: the card lists *Venue Safety Review · 2026-12-16 09:30–10:30 · Confirmed*: the time the block takes from the booking, not the booking's whole morning. It says the bookings and their events are unchanged.
- Step 5: the booking is still `Confirmed` and the event still `Planning`.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (5/5 checks)

**Screenshots:** [step1-form-filled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-003_step1-form-filled.png) · [step2-affected-bookings-listed](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-003_step2-affected-bookings-listed.png)

---

### TC-VBLOCK-004: A coordinator cannot request a blocked time (SPM-321 AC3)

**Scenario:** Studio is blocked 09:00 to 11:30 on Monday 2026-12-14 (TC-VBLOCK-001). The Coordinator tries to book Studio for 07:00 to 12:00 (it overlaps the block), then 13:00 to 18:00, then 11:30 to 12:00 (it starts exactly when the block ends), then the Saturday after the block ends.

**Preconditions:** TC-VBLOCK-001 has run. Signed in as `coordinator@test.com`; open `/staff/coordinator/4/venue-booking`.

**Steps:** On each, choose **Studio** and press **Send booking request**:
1. Date `2026-12-14`, Start **07:00**, End **12:00**.
2. Date `2026-12-14`, Start **13:00**, End **18:00**.
3. Date `2026-12-14`, Start **11:30**, End **12:00**.
4. Date `2026-12-19`, Start **07:00**, End **12:00**.

**Expected Result:**
- Step 1: refused with *The venue is unavailable for 2026-12-14 09:00–11:30. Choose other times or another venue.* and nothing is requested. It names the time the request shares with the block. There is no way to override it.
- Step 2: accepted: it shares no time with the block.
- Step 3: accepted: it starts at 11:30, exactly when the block ends, so they share no time.
- Step 4: accepted: the day after the block ends.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (5/5 checks)

**Screenshots:** [step1-refused-naming-date-and-slot](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step1-refused-naming-date-and-slot.png) · [step2-another-slot-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step2-another-slot-accepted.png) · [step3-touching-time-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step3-touching-time-accepted.png) · [step4-day-after-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-004_step4-day-after-accepted.png)

---

### TC-VBLOCK-005: Venue search leaves a blocked venue out (SPM-321 AC8; SPM-21 AC14)

**Scenario:** Garden Hall's projector is broken from 08:00 to 10:00 on Wednesday 2026-12-16. A Coordinator searching for 09:00 to 10:00 that day should not be offered it. A search starting at 10:00, the moment the block ends, or in the afternoon, should still offer it.

**Preconditions:** Venue search lists only venues with opening hours and a booking horizon, so this case uses **UAT-44 Garden Hall**. As `venue@test.com`, block it from **08:00** to **10:00** on `2026-12-16` (Reason **Equipment failure**). Then sign in as `coordinator@test.com` and open **Find a venue**.

**Steps:**
1. Search date `2026-12-16`, **Start time** `09:00`, **End time** `10:00`, press **Search**.
2. Search date `2026-12-16`, **Start time** `10:00`, **End time** `11:00`, press **Search**.
3. Search date `2026-12-16`, **Start time** `13:00`, **End time** `14:00`, press **Search**.

**Expected Result:**
- Step 1: **UAT-44 Garden Hall** is not listed; UAT-44 Harbour Room is. The summary counts a venue not shown because it is already booked in the time chosen.
- Step 2: both venues are listed. The search starts at 10:00, exactly when the block ends, so they share no time.
- Step 3: both venues are listed: the block does not reach the afternoon.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (4/4 checks)

**Screenshots:** [step1-blocked-venue-left-out](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-005_step1-blocked-venue-left-out.png) · [step2-touching-time-listed](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-005_step2-touching-time-listed.png) · [step3-other-time-both-listed](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-005_step3-other-time-both-listed.png)

---

### TC-VBLOCK-006: Lift a block, overlap, and history (SPM-321 AC5; SPM-21 AC15 to AC17, AC19)

**Scenario:** After TC-VBLOCK-001 Studio is blocked 09:00 to 11:30 (Renovation) from 2026-12-14 to 2026-12-18. Venue Staff add a Safety block over 10:00 to 12:00 on 2026-12-14 and 2026-12-15, then lift the Renovation block early. The Safety block must keep refusing the overlap, and the times only Renovation held must come free.

**Preconditions:** TC-VBLOCK-001 and TC-VBLOCK-004 have run.

**Steps:**
1. As `venue@test.com`, block **Studio** from `2026-12-14` to `2026-12-15`, Start **10:00**, End **12:00**, Reason **Safety**. It overlaps the Renovation block between 10:00 and 11:30.
2. On the **Studio Renovation** row, press **Lift**, then reload.
3. As `coordinator@test.com`, request **Studio** on `2026-12-15`, Start **07:00**, End **12:00**.
4. Request **Studio** on `2026-12-16`, Start **07:00**, End **12:00**.

**Expected Result:**
- Step 1: the second block saves although it covers some of the same time.
- Step 2: the Renovation row shows **Lifted**, with who lifted it and when, and has **no Lift button**. It stays in the list.
- Step 3: refused: *The venue is unavailable for 2026-12-15 10:00–12:00. Choose other times or another venue.* The Safety block still covers it.
- Step 4: accepted: only the lifted block covered 2026-12-16.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (4/4 checks)

**Screenshots:** [step1-overlapping-block-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step1-overlapping-block-saved.png) · [step2-renovation-lifted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step2-renovation-lifted.png) · [step3-still-refused-covered-by-second-block](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step3-still-refused-covered-by-second-block.png) · [step4-freed-time-accepted](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-006_step4-freed-time-accepted.png)

---

### TC-VBLOCK-007: Only Venue Staff can open the page (SPM-21 AC9)

**Steps:** Sign in as each account in turn and open `/staff/venue/unavailability` directly:
1. `coordinator@test.com`
2. `support@test.com`

**Expected Result:**
- Each shows *You don’t have access to this page.* with a **403** for the page request (SPM-16), and none of the blocks or the form.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (2/2 checks)

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
- Step 2: ends with *ok: all 35 checks held*. They cover a non-Venue-Staff session being refused on record, lift, list and affected bookings, the audit rows, the busy-time read of 09:00 to 10:00, a booking slot whose hours a block reaches being refused with `CS028` while a slot it does not reach is accepted, a block touching only a quarter hour of AM refusing AM, a block that starts as AM ends not refusing it, approving, holding and confirming a hold over a block recorded later being refused, the same block twice being refused with `CS079` while another reason, shorter times, or the same block after a lift are accepted, a block over the 12:00 to 13:00 lunch gap being refused with `CS078` and leaving nothing behind, the calendar read giving quarter hours in order, and lifting twice being refused.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau (2/2 checks). `checks.sql` ended with "ok: all 35 checks held"

**Reading the result:** the CLI prints `failed to execute query: error: ok: all 35 checks held`. That
is the pass. The script ends with an error on purpose, so that everything it wrote is rolled back,
and the CLI words any error as "failed". A real failure reads `error: FAILED: <the checks that did not hold>`.

**Screenshots:** none (database checks)

---

### TC-VBLOCK-009: The form lists the opening hours and will not let closed time be picked (SPM-321 AC7)

**Scenario:** Main Hall is open 07:00–24:00, one window with no break (SPM-320). Venue Staff choosing times for it should see those hours and be unable to pick time the hall is closed.

**Preconditions:** Signed in as `venue@test.com`; **Unavailability** open.

**Steps:**
1. Choose **Main Hall**. Read the line under the times.
2. Open the **Start time** list. Find 06:45, then 07:00, 11:45, 12:00, 12:45, 13:00, 18:00 and 23:45.
3. Choose Start **09:00**, then open the **End time** list. Find 09:00, 12:00, 12:15, 13:00 and 24:00.
4. Choose a different venue.

**Expected Result:**
- Step 1: *Opening hours: 07:00–24:00. A block can only cover time the venue is open.*
- Step 2: 06:45 (and every time before 07:00) is greyed and marked *(closed)* and cannot be picked; 07:00, 11:45, 12:00, 12:45, 13:00, 18:00 and 23:45 can.
- Step 3: 12:00, 12:15, 13:00 and 24:00 can be picked: with one window nothing between 09:00 and 24:00 is closed. 09:00 is greyed *(not after the start)*.
- Step 4: the Start and End times are cleared, so closed time cannot be carried to a venue where it is open.

A venue now opens once a day, so the *(closed in between)* mark on an end time can no longer arise.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Claude in Chrome by joyceetran, after Main Hall became one window (SPM-320)

**Screenshots:** [step3-one-window-end-times-open](../screenshots/2026-10-25_SPM-320_TC-VBLOCK-009_step3-one-window-end-times-open.jpg)

Earlier run with a lunch closure (07:00–12:00, 13:00–18:00, 19:00–24:00): Pass, 2026-10-22, Chrome via Playwright for JameszLau (7/7 checks). Screenshots: [step2-start-times-closed-disabled](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-009_step2-start-times-closed-disabled.png) · [step3-end-times-after-start-0900](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-009_step3-end-times-after-start-0900.png)

---

### TC-VBLOCK-010: A block over closed time is refused, naming it (SPM-321 AC7)

**Scenario:** Venue Staff A opens the form for UAT-44 Harbour Room and picks 09:00–11:30 on 2026-12-28. Before A saves, a colleague changes the Harbour Room's closing time to 11:00. A's page still shows 11:00–11:30 as open, but the server knows better.

**Preconditions:** Signed in as `venue@test.com`.

**Steps:**
1. Open the form, choose **UAT-44 Harbour Room**, From and To `2026-12-28`, Start **09:00**, End **11:30**, Reason **Maintenance**. Do not save yet.
2. In a second tab, as `venue@test.com`, open **Venues**, then **UAT-44 Harbour Room**, change **Closes** from 24 to **11** (minute 00) and press **Save venue**.
3. Back in the first tab press **Mark unavailable**.
4. Put the hours back: in the second tab set **Closes** back to **24** and press **Save venue**.

**Expected Result:**
- Step 3: refused with *The venue is closed 11:00–11:30, so it cannot be blocked then. Choose times within its opening hours (07:00–11:00).* The form still shows the venue and times chosen, and nothing is saved for 2026-12-28.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Claude in Chrome by joyceetran, with the hours changed and restored through the venue form; no block slot was saved for 2026-12-28 and Harbour Room was back to 07:00–24:00

**Screenshots:** [step3-refused-naming-11-00-11-30](../screenshots/2026-10-25_SPM-320_TC-VBLOCK-010_step3-refused-naming-11-00-11-30.jpg)

Earlier run with three windows: Pass, 2026-10-22, Chrome via Playwright for JameszLau (5/5 checks). Screenshots: [step1-form-filled-before-hours-change](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-010_step1-form-filled-before-hours-change.png) · [step2-refused-naming-the-closed-time](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-010_step2-refused-naming-the-closed-time.png)

---

### TC-VBLOCK-011: A block shows on exactly its periods of the calendar (SPM-321 AC8, SPM-323)

**Scenario:** Studio is blocked 09:00 to 11:30 (Renovation) for the week of 2026-12-14. A Coordinator looking at Studio's calendar for that week should see 09:00 to 11:30 each weekday as Blocked with the reason, and every other period as Available.

**Preconditions:** TC-VBLOCK-001 has run, and TC-VBLOCK-006 has not (it lifts the Renovation block). Signed in as `coordinator@test.com`.

**Steps:**
1. Open **Find a venue**, then Studio's calendar, and go to the week of Monday 2026-12-14 (or open the calendar with `?from=2026-12-14`).

**Expected Result:**
- Monday 2026-12-14 to Friday 2026-12-18: `09:00–09:15` to `11:15–11:30` read **Blocked** with *Renovation*. `08:45–09:00`, `11:30–11:45` and every other period read **Available** (SPM-323 reads the block's own 15-minute periods, no longer the AM slot it falls in).

**Status:** [x] Pass [ ] Fail — 2026-10-27, re-run for SPM-323 in Chrome against `pnpm dev:local`, after recording TC-VBLOCK-001's Studio block

**Screenshots:** [step1-calendar-week-of-2026-12-14](../screenshots/2026-10-27_SPM-323_TC-VBLOCK-011_step1-calendar-week-of-2026-12-14.png). Earlier run on AM/PM/Night, 2026-10-22: [step1](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-011_step1-calendar-week-of-2026-12-14.png)

---

### TC-VBLOCK-012: The same block cannot be saved twice (SPM-321)

**Scenario:** Rooftop Terrace is blocked for Maintenance on 2026-12-21, 13:00–18:00 (TC-VBLOCK-002, row 5). A second member of Venue Staff, with an old page open, enters exactly the same block. It should be refused, not stacked. A different reason, or shorter times, is a different block and is allowed. **Other** is exempt: its note is free text nothing reads, so Venue Staff may record the same Other block more than once.

**Preconditions:** TC-VBLOCK-002 has run, so the Rooftop Terrace block above is In force. Signed in as `venue@test.com`.

**Steps:**
1. Choose **Rooftop Terrace**, From and To `2026-12-21`, Start **13:00**, End **18:00**, Reason **Maintenance**, press **Mark unavailable**.
2. Change only the **Reason** to **Equipment failure** and press **Mark unavailable**.
3. Choose **Rooftop Terrace**, From and To `2026-12-21`, Start **13:00**, End **17:00**, Reason **Maintenance**, press **Mark unavailable**.
4. Choose **Rooftop Terrace**, From and To `2026-12-22`, Start **09:00**, End **11:30**, Reason **Other**, Note *Film shoot*, press **Mark unavailable**. Then do exactly the same again.

**Expected Result:**
- Step 1: refused with *That block is already in force: same venue, reason, dates and times.* Nothing is saved, and the form keeps what was entered so one field can be changed.
- Step 2: saves: the same hours under another reason is a different block (overlapping blocks are allowed). The *Saved.* message names Rooftop Terrace, 2026-12-21, 13:00–18:00, equipment failure.
- Step 3: saves: the same reason over shorter times overlaps the first but is not the same block.
- Step 4: both save. The same Other block, even with the same note, is never refused (TC-VBLOCK-002 row 7 already recorded an Other block for those hours).
- A lifted block no longer counts: after lifting, the identical block can be saved again (unit and database checks).

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-same-block-refused](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-012_step1-same-block-refused.png) · [step2-other-reason-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-012_step2-other-reason-saved.png) · [step3-shorter-block-saved](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-012_step3-shorter-block-saved.png) · [step4-other-block-saved-1](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-012_step4-other-block-saved-1.png) · [step4-other-block-saved-2](../screenshots/2026-10-22_SPM-321_TC-VBLOCK-012_step4-other-block-saved-2.png)

---

### TC-VBLOCK-013: Existing blocks convert to 15-minute slots (SPM-321 AC6)

**Scenario:** Before this change Studio had a Renovation block on 2026-12-21 and 2026-12-22 for AM and Night, and a Safety block on 2026-12-23 PM that Venue Staff had already lifted. After the upgrade they must cover exactly the same hours, none may be lost, and the lifted one must stay lifted.

**Preconditions:** Local Supabase. This case rebuilds the database only as far as the migration before this one, so it cannot follow the browser cases without a reset.

**Steps:**
1. Rebuild up to the migration before this change and load the venues:
   ```bash
   supabase db reset --version 20261020020000
   supabase db query --file scripts/seed-venues/seed.sql --local
   ```
2. Record the two blocks the old way (AM, Night, PM codes): save the SQL below as `legacy.sql` and run `supabase db query --file legacy.sql --local`.
   ```sql
with staff as (select user_account_id u from user_account where name = 'Test Venue Staff' and client_organisation_id is null),
studio as (select venue_id v from venue where location = 'Studio'),
ren as (insert into venue_unavailability (venue_id, reason_category, recorded_by_user_account_id) select v, 'Renovation', u from studio, staff returning venue_unavailability_id i),
s1 as (insert into venue_unavailability_slot (venue_unavailability_id, slot_date, slot) select i, d, s from ren, (values ('2026-12-21'::date), ('2026-12-22')) d(d), (values ('AM'), ('Night')) s(s) returning 1),
saf as (insert into venue_unavailability (venue_id, reason_category, recorded_by_user_account_id, lifted_by_user_account_id, lifted_at) select v, 'Safety', u, u, now() from studio, staff returning venue_unavailability_id i),
s2 as (insert into venue_unavailability_slot (venue_unavailability_id, slot_date, slot) select i, '2026-12-23', 'PM' from saf returning 1)
select (select count(*) from s1) as renovation_rows, (select count(*) from s2) as safety_rows
   ```
   It reports 4 Renovation rows and 1 Safety row.
3. Read the blocks before, then apply the migration, then read them again:
   ```bash
   supabase db query "select u.reason_category, case when u.lifted_at is null then 'In force' else 'Lifted' end as status, count(*) as slots, count(*) filter (where s.slot in ('AM','PM','Night')) as old_codes from venue_unavailability u join venue_unavailability_slot s using (venue_unavailability_id) group by 1,2 order by 1" --local
   supabase migration up --local
   supabase db query "select u.reason_category, case when u.lifted_at is null then 'In force' else 'Lifted' end as status, count(*) as slots, count(*) filter (where s.slot in ('AM','PM','Night')) as old_codes from venue_unavailability u join venue_unavailability_slot s using (venue_unavailability_id) group by 1,2 order by 1" --local
   ```

**Expected Result:**
- Before: Renovation, In force, 4 slots, 4 old codes; Safety, Lifted, 1 slot, 1 old code.
- After: Renovation, In force, **80** slots (2 days × AM 28–47 and Night 76–95), **0** old codes; Safety, **Lifted**, **20** slots (PM 52–71), 0 old codes. No block is lost and the lifted block is still lifted.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run for JameszLau against local Supabase (before and after read as above)

**Screenshots:** none (database case)
