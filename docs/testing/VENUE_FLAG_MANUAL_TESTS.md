# Venue Flag Manual Tests (SPM-313)

> **SPM-459:** the coordinator's *Request a venue* page is now the **Venue** tab of the
> event page, `/staff/coordinator/events/<event id>?tab=venue`. Where a case below says
> *Request a venue*, use that tab. *My events* → **Request a venue** opens it, and the old
> `/staff/coordinator/<request id>/venue-booking` URL redirects there.

## Overview

Browser checks for **SPM-313: Flag bookings when a venue is marked unavailable**. When Venue Staff
block a venue, every Confirmed booking or live Tentative Hold the block overlaps is **flagged**: a
review marker with a reason, shown to the event's assigned coordinator beside the booking's status.
Nothing is cancelled or changed. A Requested booking is not flagged, because Venue Staff cannot
approve it over a block. A lifted block does not clear a flag: it stays, and its reason shows an amber **Block lifted**
badge with the time. The coordinator clears it (SPM-310) or replaces the booking (SPM-251). A flag ends with its
booking: when a booking is cancelled, released, rejected or its hold expires, its flags close.

The rule behind it is unit-tested (`bookingsToFlagForBlock (SPM-313)`); these cases check the pages
end to end against Supabase. They are registered as `TC-VFLAG-001`–`TC-VFLAG-010` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file. The
ticked boxes and screenshots below are the working record for this run.

The flag shows in two places: on the coordinator's event page, under the **Venue** tab, in a **Flagged for review** section that lists only flagged bookings; and on **Request a venue**, where a flagged booking's row has an amber **Flagged** badge that opens the reasons on hover, focus or click.

## The people and places

Each case names who does what by role. The accounts are:

| In the cases | App name | Sign in as |
| --- | --- | --- |
| **Venue Staff** | Test Venue Staff | `venue@test.com` |
| **Coordinator** (the coordinator of Tech Summit) | Test Coordinator | `coordinator@test.com` |
| **Coordinator 2** (a coordinator of other events) | Test Coordinator 2 | `coordinator2@test.com` |

The venues are the seeded ones by their own names: Main Hall, Studio and Rooftop Terrace.

The password for all three is `TestPass123!`. Slots are AM 07:00 to 12:00, PM 13:00 to 18:00 and
Night 19:00 to 24:00, Singapore time.

## Setup

Do every step, in this order. Nothing else needs to be loaded or run by hand.

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local`. It pulls its environment from Infisical, so run
  `infisical login` and `infisical init` once (see the root [README](../../README.md#secrets-with-infisical-optional)).
- Two signed-in users are needed at once in places. Use a normal window for one and a private
  window (or another browser) for the other, so one sign-in does not replace the other.

### Steps

1. Start the local stack and rebuild the database. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   ```
   Wait for `Finished supabase db reset`, then give the stack about 15 seconds. If the next step
   fails with `relation "public.event" does not exist`, it was not ready yet: wait and run it again.
2. Load the baseline data as the Single Source of Truth lists it
   ([Set up your database](../../scripts/README.md#1-set-up-your-database), Step 2). The flag cases
   need only these two:
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   ```
3. Load the flag fixture: seven *Flag Test:* events with nine bookings. It needs no fixture run
   after it:
   ```bash
   supabase db query --file scripts/seed-booking-flags/seed.sql --local
   ```
4. Check it loaded. This lists the bookings and must show **9 rows**. `day_label` says which day
   each is on (F, F + 1 …), so you never work F out by hand. Note the *event id* of Tech Summit
   (case 006 opens it by address):
   ```bash
   supabase db query --file scripts/seed-booking-flags/show.sql --local
   ```
5. Check no block is left over from an earlier run. This must list **no rows**; if it lists any, run
   the teardown and seed commands below first. A stray block flags bookings the cases expect to be
   clean:
   ```bash
   supabase db query --file scripts/seed-booking-flags/blocks.sql --local
   ```
6. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>.

Case 010 cancels a booking with SPM-20's button, so it needs that seed as well. Run these three
after step 3 (case 010 is the only one that uses them):

```bash
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
```

To run the cases again **without** a database reset, remove the blocks the cases recorded and reload
the fixture:

```bash
supabase db query --file scripts/seed-booking-flags/teardown.sql --local
supabase db query --file scripts/seed-booking-flags/seed.sql --local
```

To see which blocks the cases have recorded so far:
`supabase db query --file scripts/seed-booking-flags/blocks.sql --local`.

### The days and the bookings

**F** is 28 days from today in Singapore time. It is far enough out that no other seed uses it.

| Event | Coordinator | Venue | Day, slot | Status | Used in |
| --- | --- | --- | --- | --- | --- |
| Flag Test: Tech Summit | The Coordinator | Main Hall | F, PM | Confirmed | 001, 005, 006, 007, 008, 009 |
| Flag Test: Tech Summit | The Coordinator | Studio | F, PM | Confirmed | 009 (its second venue) |
| Flag Test: Second Event | The Coordinator | Rooftop Terrace | F, PM | Requested | 003 |
| Flag Test: Offsite Day | The Coordinator | Main Hall | F + 4, PM | Confirmed | 007 |
| Flag Test: Hold Event | The Coordinator | Studio | F + 2, PM | Tentative Hold, live | 002 |
| Flag Test: Hold Event | The Coordinator | Studio | F + 3, PM | Tentative Hold, expired an hour ago | 002 |
| Flag Test: Workshop | Coordinator 2 | Main Hall | F, AM | Confirmed | 004 |
| Flag Test: Gala | Coordinator 2 | Main Hall | F, Night | Confirmed | 004 |
| Flag Test: Quiz | Coordinator 2 | Main Hall | F + 1, PM | Confirmed | 004, 007 |

### Order

Run the cases in order, 001 to 011. Each case adds blocks that the next ones read: 001 records the
first block on Main Hall, 002 and 003 add blocks at Studio and Rooftop Terrace, 004, 005, 006 and 009 read the
result without recording anything, 007 stacks a second block over the first on Main Hall and 008 lifts
the first. To run any case again, use the teardown and seed
commands above.

---

## Test Cases

### TC-VFLAG-001: A Confirmed booking is flagged when its venue is blocked (AC1)

**What this tests:** The moment Venue Staff block a venue over a booking, the coordinator who owns
that booking must be able to find out. Venue Staff blocks Main Hall for the PM slot on F. The Coordinator's Tech Summit is
Confirmed there. The Coordinator should open Tech Summit and see a flag saying the venue is unavailable, with
the reason, the day, the hours and when it was flagged, while the booking still reads Confirmed. Venue Staff
should see the booking in the list of bookings the block overlaps, as they already do today (SPM-21),
and not the other events booked around it.

**Preconditions:** The fixture from Setup. Signed in as Venue Staff (`venue@test.com`), then the Coordinator.

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **Main Hall**, start and end date **F**, start time **13:00**, end time **18:00**, reason **Maintenance**, and click **Mark unavailable**.
2. Read **Bookings this block overlaps**.
3. Sign in as the Coordinator (`coordinator@test.com`). Open **My events**, then *Flag Test: Tech Summit*, then the **Venue** tab.
4. Read **Flagged for review**.

**Expected Result:**
- Step 2: the list names *Flag Test: Tech Summit*, F PM, Confirmed. It does not name the Workshop, the Gala, the Quiz or the Second Event.
- Step 4: Main Hall, F PM, with the **Confirmed** badge, and one reason: "Venue unavailable · Maintenance: F 13:00 to 18:00 · flagged <today, about now>" (AC1).

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-venue-staff-affected-list](../screenshots/2026-10-21_TC-VFLAG-001_step2-venue-staff-affected-list.png) · [step4-coordinator-flag](../screenshots/2026-10-21_TC-VFLAG-001_step4-coordinator-flag.png)

---

### TC-VFLAG-002: A live hold is flagged and a lapsed one is not (AC1)

**What this tests:** A Tentative Hold keeps a slot for the coordinator, so a block over it matters. A
hold that has already run out keeps nothing, so a block over it matters to nobody. The Coordinator's Hold Event
has two holds at Studio: F + 2 is live and F + 3 ran out an hour ago. Venue Staff blocks Studio for both
days. The Coordinator should see only the live hold in the flagged list, still "On hold until …". The lapsed one
should be marked **Expired** before the block is checked, so a stale hold cannot be flagged.

**Preconditions:** The fixture from Setup. Signed in as Venue Staff, then the Coordinator.

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **Studio**, start date **F + 2**, end date **F + 3**, start time **13:00**, end time **18:00**, reason **Safety**, and save.
2. As the Coordinator open *Flag Test: Hold Event*, then the **Venue** tab, and read **Flagged for review**.
3. Read the two holds' status:
   ```sql
   select bs.slot_date, b.status from booking b join booking_slot bs using (booking_id)
     join event e on e.event_id = b.event_id where e.name = 'Flag Test: Hold Event' order by bs.slot_date;
   ```

**Expected Result:**
- Step 2: one booking, Studio on F + 2, **Tentative Hold**, "On hold until …", with the reason "Safety: F + 2 13:00 to 18:00". Nothing is listed for F + 3.
- Step 3: F + 2 `Tentative Hold`, F + 3 `Expired`.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-coordinator-holds](../screenshots/2026-10-21_TC-VFLAG-002_step2-coordinator-holds.png)

---

### TC-VFLAG-003: A Requested booking is not flagged (AC1)

**What this tests:** A Requested booking is a request Venue Staff have not answered yet, and Venue
Staff cannot approve one over a block. The Coordinator's Second Event is Requested for Rooftop Terrace on F PM. Venue Staff
blocks Rooftop Terrace for that slot. The Coordinator's event should show no flag. When Venue Staff tries to approve the
request they are stopped, and rejecting it is what tells the Coordinator. The refusal is not new; this proves
flagging leaves Requested bookings to it.

**Preconditions:** The fixture from Setup. Signed in as Venue Staff, then the Coordinator.

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **Rooftop Terrace**, start and end date **F**, start time **13:00**, end time **18:00**, reason **Renovation**, and save. Read **Bookings this block overlaps**.
2. As the Coordinator open *Flag Test: Second Event* and its **Venue** tab.
3. As Venue Staff open **Requests** and the Rooftop Terrace request for F PM (*Flag Test: Second Event*). Click **Approve booking**.
4. Write a note and click **Reject**.
5. Read the notification:
   ```sql
   select status, message_content from notification
    where trigger_scenario = 'venue-booking-decided'
      and related_booking_id = (select b.booking_id from booking b join event e using (event_id) where e.name = 'Flag Test: Second Event');
   ```

**Expected Result:**
- Step 1: the list names *Flag Test: Second Event*, F PM, Requested.
- Step 2: no **Flagged for review** section.
- Step 3: the approval is refused: "The venue is unavailable for F 13:00–18:00. Choose other times or another venue." The booking is still **Requested**.
- Step 4: the booking is **Rejected**.
- Step 5: one `Sent` notice for the Coordinator, "Rooftop Terrace rejected for Flag Test: Second Event", with Venue Staff's note as the reason.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-venue-staff-affected-list](../screenshots/2026-10-21_TC-VFLAG-003_step1-venue-staff-affected-list.png) · [step2-coordinator-second-event](../screenshots/2026-10-21_TC-VFLAG-003_step2-coordinator-second-event.png) · [step3-venue-staff-approval-refused](../screenshots/2026-10-21_TC-VFLAG-003_step3-venue-staff-approval-refused.png) · [step4-venue-staff-rejected](../screenshots/2026-10-21_TC-VFLAG-003_step4-venue-staff-rejected.png)

---

### TC-VFLAG-004: Only bookings the block overlaps are flagged (AC2)

**What this tests:** A block must flag exactly the bookings it covers, and nothing near them. After
TC-VFLAG-001, Main Hall is blocked for F PM. Next to Tech Summit sit three Confirmed bookings of
Coordinator 2's: the Workshop on F AM, the Gala on F Night and the Quiz on F + 1 PM. Coordinator 2 should see none of
them flagged. This is the check that a block on one slot does not leak onto the slot before or after
it, or onto the next day.

**Preconditions:** After TC-VFLAG-001. Nothing new to record. Run `blocks.sql`: it must list **one**
block, Main Hall on F, 13:00 to 18:00 only. If it lists more (a block over other hours, or one on another
day), that block is what flags the neighbours: run the teardown and seed commands and start again at
001. Signed in as Coordinator 2 (`coordinator2@test.com`).

**Steps:**
1. As Coordinator 2 open **My events**, then *Flag Test: Workshop*, *Flag Test: Gala* and *Flag Test: Quiz* in turn. On each open the **Venue** tab.

**Expected Result:**
- None shows a **Flagged for review** section.

**Status:** [x] Pass [ ] Fail — 25/10/2026, run in Chrome via Claude in Chrome by Claude Code, on the one-window build after a fresh reset and the Setup seeds (F = 2026-11-22). TC-VFLAG-001 step 1 recorded the one block first, and its overlap list named only Tech Summit; `blocks.sql` listed that block alone. Each of the three still reads **Confirmed**.

**Screenshots:** [step1-coordinator-2-workshop](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_step1-coordinator-2-workshop.jpg) · [step1-coordinator-2-gala](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_step1-coordinator-2-gala.jpg) · [step1-coordinator-2-quiz](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_step1-coordinator-2-quiz.jpg)

Earlier run: Pass, 21/10/2026, Chrome via Playwright for JameszLau. Screenshots: [step1-coordinator-2-workshop](../screenshots/2026-10-21_TC-VFLAG-004_step1-coordinator-2-workshop.png) · [step1-coordinator-2-gala](../screenshots/2026-10-21_TC-VFLAG-004_step1-coordinator-2-gala.png) · [step1-coordinator-2-quiz](../screenshots/2026-10-21_TC-VFLAG-004_step1-coordinator-2-quiz.png)

**The touching boundary, tried in the browser (not a registered case):** a booking that only *touches* a
block needs a block that starts or ends exactly where AM, PM or Night does. When this case was first run the
seeded venues were closed for the hour on either side of the PM slot (12:00 to 13:00 and 18:00 to 19:00), so
the form would not record one. Since SPM-320 they open 07:00 to 24:00 with no break, so on 25/10/2026, straight
after the re-run above, Venue Staff recorded two Safety blocks on Main Hall on F: 12:00 to 13:00, starting where the
Workshop's AM booking ends, and 18:00 to 19:00, ending where the Gala's Night booking starts. Each saved with
*No bookings are affected*, Coordinator 2 still saw no **Flagged for review** on the Workshop or the Gala, and
`booking_review_flag` held only the Tech Summit's Maintenance reason. As a control, so the check cannot pass
vacuously, two more blocks a quarter-hour into each booking, 11:45 to 12:00 and 19:00 to 19:15, each listed the
one booking in their overlap list; both events then showed **Flagged** for Coordinator 2 and the table held one
Safety reason for each. The unit tests cover the same boundary with times (a block 13:00 to 15:00 and a booking
starting 15:00 do not overlap; 15:15 does), and `scripts/seed-booking-flags/checks.sql` covers it in the
database.

**Screenshots:** [boundary1-touch-workshop-end](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary1-touch-workshop-end.jpg) · [boundary2-touch-gala-start](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary2-touch-gala-start.jpg) · [boundary3-workshop-not-flagged](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary3-workshop-not-flagged.jpg) · [boundary4-gala-not-flagged](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary4-gala-not-flagged.jpg) · [boundary5-control-workshop](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary5-control-workshop.jpg) · [boundary6-control-gala](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary6-control-gala.jpg) · [boundary7-workshop-flagged](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary7-workshop-flagged.jpg) · [boundary8-gala-flagged](../screenshots/2026-10-25_SPM-320_TC-VFLAG-004_boundary8-gala-flagged.jpg)

These blocks flag the Workshop and the Gala, so run the teardown and seed commands before running this file's
cases again.

---

### TC-VFLAG-005: A flagged booking keeps its status and its event (AC3)

**What this tests:** A flag is a marker, not an action. After TC-VFLAG-001 Tech Summit is flagged.
The Coordinator should still see the event in **Planning**, not cancelled, with its name and date as seeded, and
the flagged booking should still read Confirmed. Without this check a flag could quietly turn into a
cancellation.

**Preconditions:** After TC-VFLAG-001. Signed in as the Coordinator.

**Steps:**
1. Open *Flag Test: Tech Summit*. Read its header and status, then the **Venue** tab.
2. Read the database:
   ```sql
   select v.location, b.status, e.status as event_status, e.name, e.preferred_date
     from booking b join event e on e.event_id = b.event_id join venue v on v.venue_id = b.venue_id
    where e.name = 'Flag Test: Tech Summit' order by v.location;
   ```

**Expected Result:**
- Step 1: the header reads *Flag Test: Tech Summit* with the **Planning** badge, and the flagged Main Hall booking shows **Confirmed**.
- Step 2: two rows, one for each venue the event is booked at (Main Hall and Studio), both bookings `Confirmed`, the event `Planning`, its date F.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-coordinator-event-and-venue-tab](../screenshots/2026-10-21_TC-VFLAG-005_step1-coordinator-event-and-venue-tab.png)

---

### TC-VFLAG-006: Only the event's coordinator sees the flag (AC4)

**What this tests:** The flag is for the coordinator who has to act on it. The Coordinator, who is assigned to
Tech Summit, sees it. Coordinator 2, a coordinator assigned to other events, must not: opening Tech Summit's
address should give them the access-denied page the event already gives them, not the event and not the
flag.

**Preconditions:** After TC-VFLAG-001. The Tech Summit event id from Setup step 4.

**Steps:**
1. As the Coordinator open *Flag Test: Tech Summit* and its **Venue** tab, and read the flag.
2. Sign in as Coordinator 2. Open `http://localhost:3000/staff/coordinator/events/<Tech Summit event id>`.

**Expected Result:**
- Step 1: the flag is listed with its reason and when it was flagged.
- Step 2: the access-denied screen (403). No event details and no flag are shown.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-coordinator-2-denied](../screenshots/2026-10-21_TC-VFLAG-006_step2-coordinator-2-denied.png)

---

### TC-VFLAG-007: Stacked blocks give a booking one reason each (AC5)

**What this tests:** Blocks can stack. Venue Staff records a second block, an equipment failure from F to
F + 8 on the PM slot, over the first block on F PM. Tech Summit now sits under both, so the Coordinator should
see **two** reasons on it, one per block. The Quiz (F + 1 PM) and the Coordinator's Offsite Day (F + 4 PM) sit
under the second block only, so each shows **one** reason.

**Preconditions:** After TC-VFLAG-001. Signed in as Venue Staff, then the Coordinator, then Coordinator 2.

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **Main Hall**, start date **F**, end date **F + 8**, start time **13:00**, end time **18:00**, reason **Equipment failure**, and save.
2. As the Coordinator open *Flag Test: Tech Summit* and *Flag Test: Offsite Day*, each on its **Venue** tab. Read their flags.
3. As Coordinator 2 open *Flag Test: Quiz*, *Flag Test: Workshop* and *Flag Test: Gala* on their **Venue** tabs.

**Expected Result:**
- Step 2, Tech Summit: two reasons, "Maintenance: F 13:00 to 18:00" and "Equipment failure: F 13:00 to 18:00". Offsite Day: one reason, "Equipment failure: F + 4 13:00 to 18:00".
- Step 3: the Quiz shows one reason, "Equipment failure: F + 1 13:00 to 18:00". The Workshop and the Gala show none.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-coordinator-two-reasons](../screenshots/2026-10-21_TC-VFLAG-007_step2-coordinator-two-reasons.png) · [step2-coordinator-offsite](../screenshots/2026-10-21_TC-VFLAG-007_step2-coordinator-offsite.png) · [step3-coordinator-2-quiz](../screenshots/2026-10-21_TC-VFLAG-007_step3-coordinator-2-quiz.png)

**Saving the same block twice** adding no second reason cannot be reached from the page. It is proven
by `scripts/seed-booking-flags/checks.sql`, which also checks two blocks over one booking in the
database.

---

### TC-VFLAG-008: Lifting a block keeps the flag and shows the lift (AC6)

**What this tests:** Lifting a block never undoes a flag; the coordinator decides what happens to it.
After TC-VFLAG-007 Tech Summit has two reasons. Venue Staff lifts the first block (Maintenance). The Coordinator should
still see the flag. The Maintenance reason should now carry an amber **Block lifted** badge with the
time, and a line saying the venue is free again but the flag stays until they act. The Equipment
failure reason should have no badge. Tech Summit stays Confirmed.

**Preconditions:** After TC-VFLAG-007. Signed in as Venue Staff, then the Coordinator.

**Steps:**
1. As Venue Staff open **Unavailability**, find the Main Hall **Maintenance** block that is In force and click **Lift**.
2. As the Coordinator open *Flag Test: Tech Summit* and its **Venue** tab, and read its flag.

**Expected Result:**
- Step 2: both reasons are still listed. The Maintenance reason shows an amber badge "Block lifted · <date, time>" and its text, "Maintenance: F 13:00 to 18:00", is unchanged. The Equipment failure reason has no badge. The booking still shows **Confirmed**.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-coordinator-after-lift](../screenshots/2026-10-21_TC-VFLAG-008_step2-coordinator-after-lift.png)

---

### TC-VFLAG-009: Only the blocked venue's booking is flagged (AC7)

**What this tests:** Tech Summit has two venue bookings on F PM: Main Hall and Studio. The blocks so far
cover Main Hall only. The Coordinator should see Main Hall in the flagged list and not Studio. A flag belongs to a
booking, not to the event, so an event with several venues does not turn flagged all over because one
of them is blocked.

**Preconditions:** After TC-VFLAG-001. Signed in as the Coordinator.

**Steps:**
1. Open *Flag Test: Tech Summit* and its **Venue** tab. Read **Flagged for review**.
2. Read the flags by SQL:
   ```sql
   select v.location, count(f.*) as flags
     from booking b join event e using (event_id) join venue v on v.venue_id = b.venue_id
     left join booking_review_flag f on f.booking_id = b.booking_id and f.cleared_at is null
    where e.name = 'Flag Test: Tech Summit' group by v.location order by v.location;
   ```

**Expected Result:**
- Step 1: Main Hall is listed, Studio is not.
- Step 2: Main Hall has flags, Studio has `0`.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-coordinator-two-venues](../screenshots/2026-10-21_TC-VFLAG-009_step1-coordinator-two-venues.png)

---

### TC-VFLAG-010: A flag ends with its booking, and shows on Request a venue (AC4, AC8)

**What this tests:** A flag is there so a live booking gets looked at, and the Coordinator manages their bookings
on **Request a venue**, so the flag has to show there. When the booking stops existing the flag has
nothing left to say, and it must not hang about: it would keep showing, and it would stop the event
being confirmed. Venue Staff blocks the UAT-44 Harbour Room for the morning and for the night on C (two blocks), and the Founders' Gala Dinner
has a Confirmed booking in each (P in the morning, Q at night). On **Request a venue** both rows should
carry an amber **Flagged** badge, and opening one shows the reasons. The Coordinator then cancels P with the
**Cancel booking** button from SPM-20. P's flag should go, from that page and from the Venue tab, and be
closed as "booking ended" in the database, while Q's flag stays.

**Preconditions:** The three extra seeds from Setup. Signed in as Venue Staff, then the Coordinator. **C** is 10 days
from today (the day the SPM-20 seed books).

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **UAT-44 Harbour Room**, start and end date **C**, start time **07:00**, end time **12:00**, reason **Renovation**, and save. Record a second block the same way for **19:00** to **24:00** (a block is one range of times, so the morning and the night are two blocks).
2. As the Coordinator open **My events**, *Founders' Gala Dinner*, the **Venue** tab, and read **Flagged for review**.
3. Scroll down the same tab to **Booking requests for this event** (SPM-459). On the Harbour Room rows for C AM (P) and C Night (Q), read the Status column, then hover over, or click, the **Flagged** badge on Q.
4. On P's row click **Cancel booking**, then **Yes, cancel booking**. Read the Status column of both rows again.
5. Return to the event's **Venue** tab and read **Flagged for review** again.
6. Read the flags:
   ```sql
   select bs.slot, f.cleared_how, f.cleared_at is not null as closed
     from booking_review_flag f join booking_slot bs using (booking_id)
     join booking b on b.booking_id = f.booking_id join event e on e.event_id = b.event_id
    where e.name = 'Founders'' Gala Dinner' and bs.slot_date = current_date + 10 order by bs.slot;
   ```

**Expected Result:**
- Step 2: two flagged bookings at the Harbour Room, "C 07:00 to 12:00" and "C 19:00 to 24:00", each with the reason "Renovation: C 07:00 to 12:00" or "Renovation: C 19:00 to 24:00".
- Step 3: both rows show **Confirmed** and an amber **Flagged** badge. Q's card reads "Flagged for review", "Something changed under this booking. It keeps its status and nothing has been cancelled.", then "Venue unavailable", "Renovation: C 19:00 to 24:00" and "Flagged <date, time>".
- Step 4: P's row reads **Released** and no longer has a badge. Q's row is still **Confirmed** and **Flagged**.
- Step 5: only the Night booking is listed. The morning one is gone.
- Step 6: the AM row is closed with `booking-ended`; the Night row is open (`cleared_how` empty, `closed` false).

**Status:** [ ] Pass [ ] Fail — last passed 21/10/2026, before SPM-459 moved step 3 into the Venue tab, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-coordinator-two-flags](../screenshots/2026-10-21_TC-VFLAG-010_step2-coordinator-two-flags.png) · [step3-coordinator-badge-card](../screenshots/2026-10-21_TC-VFLAG-010_step3-coordinator-badge-card.png) · [step4-coordinator-cancelled](../screenshots/2026-10-21_TC-VFLAG-010_step4-coordinator-cancelled.png) · [step5-coordinator-one-flag](../screenshots/2026-10-21_TC-VFLAG-010_step5-coordinator-one-flag.png)

---

### TC-VFLAG-011: A block over part of a booking flags it, naming the block's own hours (SPM-321)

**What this tests:** Since SPM-321 a block is a start and end time, so it can cover only part of a
booking. Coordinator 2's Gala is Confirmed at Main Hall on F from 19:00 to 24:00 (the Night slot).
Venue Staff block Main Hall on F from 19:00 to 20:00, the Gala's first hour. The Gala should be
flagged, and the reason should name the hour that clashes, 19:00 to 20:00, not the Gala's whole evening.
The Workshop, booked at Main Hall the same day from 07:00 to 12:00, shares no time with the block and
must stay clear.

**Preconditions:** After TC-VFLAG-010 (or any time after TC-VFLAG-004). Nothing else is blocked at
Main Hall on F from 19:00. Signed in as Venue Staff, then Coordinator 2 (`coordinator2@test.com`).

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **Main Hall**, start and end date **F**, start time **19:00**, end time **20:00**, reason **Maintenance**, and save. Read **Bookings this block overlaps**.
2. As Coordinator 2 open *Flag Test: Gala* and its **Venue** tab. Read **Flagged for review**.
3. Open *Flag Test: Workshop* and its **Venue** tab.

**Expected Result:**
- Step 1: the list shows *Flag Test: Gala · F 19:00 to 24:00 · Confirmed* and not the Workshop, Quiz or Tech Summit.
- Step 2: **Flagged for review** with the reason "Maintenance: F 19:00 to 20:00", and the booking still **Confirmed**.
- Step 3: no **Flagged for review** section.

**Status:** [x] Pass [ ] Fail — 2026-10-22, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-venue-staff-affected-list](../screenshots/2026-10-22_SPM-321_TC-VFLAG-011_step1-venue-staff-affected-list.png) · [step2-coordinator-2-gala-flagged](../screenshots/2026-10-22_SPM-321_TC-VFLAG-011_step2-coordinator-2-gala-flagged.png) · [step3-coordinator-2-workshop-not-flagged](../screenshots/2026-10-22_SPM-321_TC-VFLAG-011_step3-coordinator-2-workshop-not-flagged.png)
