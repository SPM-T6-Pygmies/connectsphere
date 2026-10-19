# Venue Flag Manual Tests (SPM-313)

## Overview

Browser checks for **SPM-313: Flag bookings when a venue is marked unavailable**. When Venue Staff
block a venue, every Confirmed booking or live Tentative Hold the block overlaps is **flagged**: a
review marker with a reason, shown to the event's assigned coordinator beside the booking's status.
Nothing is cancelled or changed. A Requested booking is not flagged, because Venue Staff cannot
approve it over a block. A lifted block does not clear a flag: it stays, and its reason records the
lift. The coordinator clears it (SPM-310) or replaces the booking (SPM-251).

The rule behind it is unit-tested (`bookingsToFlagForBlock (SPM-313)`); these cases check the pages
end to end against Supabase. They are registered as `TC-VFLAG-001`–`TC-VFLAG-009` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file. The
ticked boxes and screenshots below are the working record for this run.

**Not runnable until the flag is built.** Every case reads the flag on the coordinator's event page
(subtask SPM-447) or in the database (SPM-444, SPM-445). Until then each case is `Not run`.

## The people and places

Every case is told as a story. Read the names like this:

| In the cases | In the app | Sign in as |
| --- | --- | --- |
| **Sam**, Venue Staff | Test Venue Staff | `venue@test.com` |
| **Dana**, the coordinator of Tech Summit | Test Coordinator | `coordinator@test.com` |
| **Priya**, another coordinator | Test Coordinator 2 | `coordinator2@test.com` |
| **Hall A** | Main Hall | |
| **Hall C** | Studio | |

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
4. Check it loaded. This lists the bookings and must show **9 rows**; note the *event id* of Tech
   Summit (cases 006 and 007 open it by address):
   ```bash
   supabase db query --file scripts/seed-booking-flags/show.sql --local
   ```
5. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>.

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
| Flag Test: Tech Summit | Dana | Hall A | F, PM | Confirmed | 001, 005, 006, 007, 008, 009 |
| Flag Test: Tech Summit | Dana | Hall C | F, PM | Confirmed | 009 (its second venue) |
| Flag Test: Second Event | Dana | Hall A | F, PM | Requested | 003 |
| Flag Test: Offsite Day | Dana | Hall A | F + 4, PM | Confirmed | 007 |
| Flag Test: Hold Event | Dana | Hall C | F + 2, PM | Tentative Hold, live | 002 |
| Flag Test: Hold Event | Dana | Hall C | F + 3, PM | Tentative Hold, expired an hour ago | 002 |
| Flag Test: Workshop | Priya | Hall A | F, AM | Confirmed | 004 |
| Flag Test: Gala | Priya | Hall A | F, Night | Confirmed | 004 |
| Flag Test: Quiz | Priya | Hall A | F + 1, PM | Confirmed | 004, 007 |

### Order

Run the cases in order, 001 to 009. Each case adds blocks that the next ones read: 001 records the
first block on Hall A, 004 and 005 read the result without recording anything, 007 stacks a second
block over the first and 008 lifts the first. To run any case again, use the teardown and seed
commands above.

---

## Test Cases

### TC-VFLAG-001: A Confirmed booking is flagged when its venue is blocked (AC1)

**What this tests:** The moment Venue Staff block a venue over a booking, the coordinator who owns
that booking must be able to find out. Sam blocks Hall A for the PM slot on F. Dana's Tech Summit is
Confirmed there. Dana should open Tech Summit and see a flag saying the venue is unavailable, with
the block's day, the hours and when it was flagged. Sam should see the same booking in the list of
bookings the block sits over, as he already does today (SPM-21).

**Preconditions:** The fixture from Setup. Signed in as Sam (`venue@test.com`), then Dana.

**Steps:**
1. As Sam open **Unavailability**. Choose **Hall A** (Main Hall), start and end date **F**, slot **PM**, reason **Maintenance**, and save.
2. Read the list of bookings the block sits over.
3. Sign in as Dana (`coordinator@test.com`). Open **Events**, then *Flag Test: Tech Summit*.
4. Read the venue bookings on the event page.

**Expected Result:**
- Step 2: the list names *Flag Test: Tech Summit*, Hall A, F PM, and also *Flag Test: Second Event* (Requested). It does not list the Workshop, the Gala or the Quiz.
- Step 4: the Hall A booking shows a flag: "Venue unavailable", "Maintenance: F 13:00 to 18:00" and the time it was flagged (about now). Its badge still reads **Confirmed**.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

---

### TC-VFLAG-002: A live hold is flagged and a lapsed one is not (AC1)

**What this tests:** A Tentative Hold keeps a slot for the coordinator, so a block over it matters. A
hold that has already run out keeps nothing, so a block over it matters to nobody. Dana's Hold Event
has two holds at Hall C: F + 2 is live and F + 3 ran out an hour ago. Sam blocks Hall C for both
days. Dana should see the live hold flagged and the lapsed one show **Expired** with no flag. This
also proves the lapsed hold is marked Expired before the block is checked, so a stale hold cannot be
flagged.

**Preconditions:** The fixture from Setup. Signed in as Sam, then Dana.

**Steps:**
1. As Sam open **Unavailability**. Choose **Hall C** (Studio), start date **F + 2**, end date **F + 3**, slot **PM**, reason **Safety**, and save.
2. Sign in as Dana. Open *Flag Test: Hold Event* and read its venue bookings.

**Expected Result:**
- Step 2: the F + 2 hold shows **Tentative Hold**, "On hold until …", and a flag "Venue unavailable". The F + 3 booking shows **Expired** and no flag.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

---

### TC-VFLAG-003: A Requested booking is not flagged (AC1)

**What this tests:** A Requested booking is a request Venue Staff have not answered yet, and Venue
Staff cannot approve one over a block. So Dana's Second Event, Requested for Hall A on F PM, is not
flagged. Sam is stopped when he tries to approve it, and rejecting it is what tells Dana. The
refusal is not new; this proves flagging leaves Requested bookings to it.

**Preconditions:** After TC-VFLAG-001: the Hall A block on F PM is in force. Signed in as Sam, then Dana.

**Steps:**
1. As Dana open *Flag Test: Second Event*. Read its venue booking.
2. As Sam open **Requests** and the Hall A request for F PM from *Flag Test: Second Event*. Click **Approve booking**.
3. Click **Reject**, write a note and confirm.
4. As Dana open the Inbox.

**Expected Result:**
- Step 1: the booking shows **Requested** and no flag.
- Step 2: the approval is refused: "Venue … is blocked for F PM". The booking is still Requested.
- Step 3: the booking becomes **Rejected**.
- Step 4: Dana has a notice that the request was rejected, with Sam's note.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

---

### TC-VFLAG-004: Only bookings the block overlaps are flagged (AC2)

**What this tests:** A block must flag exactly the bookings it covers, and nothing near them. After
TC-VFLAG-001, Hall A is blocked for F PM. Next to Tech Summit sit three Confirmed bookings of
Priya's: the Workshop on F AM, the Gala on F Night and the Quiz on F + 1 PM. Priya should see none of
them flagged. This is the check that a block on one slot does not leak onto the slot before or after
it, or onto the next day.

**Preconditions:** After TC-VFLAG-001. Nothing new to record. Signed in as Priya (`coordinator2@test.com`).

**Steps:**
1. As Priya open *Flag Test: Workshop*, *Flag Test: Gala* and *Flag Test: Quiz* in turn. Read each one's venue booking.

**Expected Result:**
- All three show **Confirmed** and no flag.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

**A boundary the browser cannot reach:** slots always leave a one-hour gap, so a booking that only
*touches* a block cannot be made with slots. The unit tests cover it with times (a block 13:00 to
15:00 and a booking starting 15:00 do not overlap; 15:15 does). It becomes a case after SPM-321.

---

### TC-VFLAG-005: A flagged booking keeps its status and its event (AC3)

**What this tests:** A flag is a marker, not an action. After TC-VFLAG-001 Tech Summit is flagged.
Dana should still see it Confirmed, the event should not be cancelled, and everything she entered
about the event should still be readable. Without this check a flag could quietly turn into a
cancellation.

**Preconditions:** After TC-VFLAG-001. Signed in as Dana.

**Steps:**
1. Open *Flag Test: Tech Summit*. Read the event's status and details.
2. Open its venue booking tab and read the Hall A booking.
3. Read the database:
   ```sql
   select b.status, e.status as event_status, e.name, e.preferred_date
     from booking b join event e on e.event_id = b.event_id
    where e.name = 'Flag Test: Tech Summit' order by b.booking_id;
   ```

**Expected Result:**
- Step 1: the event is not cancelled, and its name and date are as seeded.
- Step 2: the Hall A booking is **Confirmed**, flagged.
- Step 3: both bookings `Confirmed`, the event status unchanged (`Planning`).

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

---

### TC-VFLAG-006: Only the event's coordinator sees the flag (AC4)

**What this tests:** The flag is for the coordinator who has to act on it. Dana, who is assigned to
Tech Summit, sees it. Priya, a coordinator assigned to other events, must not: opening Tech Summit's
address should give her the access-denied page the event already gives her, not the event and not the
flag.

**Preconditions:** After TC-VFLAG-001. The Tech Summit event id from Setup step 4.

**Steps:**
1. As Dana open *Flag Test: Tech Summit* and read the flag.
2. Sign in as Priya. Open `http://localhost:3000/staff/coordinator/<Tech Summit event id>`.

**Expected Result:**
- Step 1: the flag is listed with its reason and when it was flagged.
- Step 2: the access-denied screen. No event details and no flag are shown.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

---

### TC-VFLAG-007: Stacked blocks give a booking one reason each (AC5)

**What this tests:** Blocks can stack. Sam records a second block, an equipment failure from F to
F + 8 on the PM slot, over the first block on F PM. Tech Summit now sits under both, so Dana should
see **two** reasons on it, one per block. The Quiz (F + 1 PM) and Dana's Offsite Day (F + 4 PM) sit
under the second block only, so each shows **one** reason. The Workshop, the Gala and the Second Event
are still not flagged.

**Preconditions:** After TC-VFLAG-001. Signed in as Sam, then Dana, then Priya.

**Steps:**
1. As Sam open **Unavailability**. Choose **Hall A**, start date **F**, end date **F + 8**, slot **PM**, reason **Equipment failure**, and save.
2. As Dana open *Flag Test: Tech Summit* and *Flag Test: Offsite Day*. Read their flags.
3. As Priya open *Flag Test: Quiz*, *Flag Test: Workshop* and *Flag Test: Gala*. Read their flags.

**Expected Result:**
- Step 2, Tech Summit: two reasons, "Maintenance: F 13:00 to 18:00" and "Equipment failure: F 13:00 to 18:00". Offsite Day: one reason, "Equipment failure: F + 4 13:00 to 18:00".
- Step 3: the Quiz shows one reason, "Equipment failure: F + 1 13:00 to 18:00". The Workshop and the Gala show none.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

**Saving the same block twice** adding no second reason cannot be reached from the page. It is proven
on scratch Postgres (SPM-445), with two staff saving overlapping blocks at once.

---

### TC-VFLAG-008: Lifting a block keeps the flag and notes the lift (AC6)

**What this tests:** Lifting a block never undoes a flag; the coordinator decides what happens to it.
After TC-VFLAG-007 Tech Summit has two reasons. Sam lifts the first block (Maintenance). Dana should
still see the flag, with the Maintenance reason now saying the block was lifted and when, and the
Equipment failure reason unchanged. Tech Summit stays Confirmed.

**Preconditions:** After TC-VFLAG-007. Signed in as Sam, then Dana.

**Steps:**
1. As Sam open **Unavailability**, find the Hall A **Maintenance** block and click **Lift**.
2. As Dana open *Flag Test: Tech Summit* and read its flag.

**Expected Result:**
- Step 2: both reasons are still listed. The Maintenance reason reads "… block lifted <time>". The Equipment failure reason is as before. The booking is still **Confirmed**.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet

---

### TC-VFLAG-009: Only the blocked venue's booking is flagged (AC7)

**What this tests:** Tech Summit has two venue bookings on F PM: Hall A and Hall C. The blocks so far
cover Hall A only. Dana should see the Hall A booking flagged and the Hall C booking clean. A flag
belongs to a booking, not to the event, so an event with several venues does not turn flagged all over
because one of them is blocked.

**Preconditions:** After TC-VFLAG-001. Signed in as Dana.

**Steps:**
1. Open *Flag Test: Tech Summit* and read both venue bookings.

**Expected Result:**
- Hall A: **Confirmed**, flagged. Hall C: **Confirmed**, no flag.

**Status:** [ ] Pass [ ] Fail — not run

**Screenshots:** none yet
