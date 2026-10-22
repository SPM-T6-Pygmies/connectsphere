# Venue Hold Manual Tests (SPM-218, SPM-219, SPM-253, SPM-254)

## Overview

Browser checks for **SPM-218: Place a tentative hold on a venue slot**, **SPM-219: Confirm or
release a tentative hold**, **SPM-253: Expire an unconfirmed hold** and **SPM-254: Warn the coordinator of hold expiry**. Venue
Staff place a hold on a booking request while the Event Coordinator is
finalising the event. The hold keeps the request's slots from everyone else for
72 hours (`DEFAULT_HOLD_HOURS`), or until its slot starts if that is sooner, and then lapses to
**Expired** (SPM-253). The rules behind it
are unit-tested (`decideBooking placing a hold (SPM-218)` and the use case, mapper and
repository tests tagged SPM-218) and the database function was proven on a scratch
Postgres; these cases check the pages end to end against Supabase.

These cases are registered as `TC-VHOLD-001`–`TC-VHOLD-013` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the
PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.
The ticked boxes and screenshots below are the working record for this run.

No case waits out a hold: TC-VHOLD-008 and 010 set an expiry in the past with SQL instead. A held booking is listed under **Decided**,
beside Confirmed ones; the list filters did not change.

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
   ([Set up your database](../../scripts/README.md#1-set-up-your-database), Step 2):
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-equipment/seed.sql --local
   ```
3. Add the two holds at Main Hall on day **H**, 21 days from today (AM expired an hour ago, PM
   expiring in thirty days). They belong to their own event, *Holds Test Event*:
   ```bash
   supabase db query --file scripts/seed-booking-holds/seed.sql --local
   ```
4. Add the fixture: the nine booking requests the cases decide on, and the Rooftop Terrace block.
   Run it **once**; it adds rows every time, so to start again go back to step 1:
   ```bash
   supabase db query --file scripts/seed-booking-holds/fixture.sql --local
   ```
5. Check the fixture loaded. This lists the Founders' Gala Dinner's bookings, and must show **9 rows**:
   ```bash
   supabase db query --local "select b.booking_id, v.location, bs.slot_date, bs.slot, b.status from booking b join venue v on v.venue_id = b.venue_id join booking_slot bs on bs.booking_id = b.booking_id where b.event_id = (select event_id from event where name = 'Founders'' Gala Dinner') order by b.booking_id"
   ```
   Note the nine booking ids. In id order they are **A, B, C, X, Y, D, E, F, G** (the table below).
   The cases write `<booking A>` where you put A's id.
6. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>. Venue Staff is
   `venue@test.com`, the coordinator is `coordinator@test.com`; the password for both is `TestPass123!`.

### The days and the bookings

**T** is 14 days from today and **H** is 21 days from today, both in Singapore time. Venue search
looks 60 days ahead, so it can still see T.

| In id order | Booking | Venue | Day, slot | Status | Used in |
| --- | --- | --- | --- | --- | --- |
| 1st | A | Studio | T, AM | Requested | held in TC-VHOLD-001 |
| 2nd | B | Studio | T, AM | Requested | same slot as A, refused in TC-VHOLD-002 |
| 3rd | C | Studio | T + 1, PM | Requested | a different slot, unaffected, TC-VHOLD-002 |
| 4th | X | Main Hall | T + 2, Night | Confirmed | already confirmed, TC-VHOLD-003 and 005 |
| 5th | Y | Main Hall | T + 2, Night | Requested | same slot as X, refused in TC-VHOLD-003 |
| 6th | D | Main Hall | H, AM | Requested | over the expired hold, TC-VHOLD-004 |
| 7th | E | Main Hall | H, PM | Requested | over the live hold, TC-VHOLD-004 |
| 8th | F | Rooftop Terrace | T + 6, AM | Requested | its slot blocked after the request, TC-VHOLD-003 |
| 9th | G | UAT-44 Harbour Room | T + 3, AM | Requested | held, then searched for, TC-VHOLD-002 |

Only the two UAT venues have slots and a booking horizon recorded, so only they can be found by a
date-and-slot search. Open any booking as `/staff/venue/<booking id>`, or from **Requests** and
**Decided** on the left.

### Running the SQL checks

The cases read the database with SQL. Run a query with
`supabase db query --local "<sql>"`, or paste it into Supabase Studio's SQL editor at
<http://127.0.0.1:54323>. Replace each `<booking X>` with that booking's id from step 5.

### Order

Run the cases in order, TC-VHOLD-001 to 011: TC-VHOLD-002 and 005 start from the hold TC-VHOLD-001
placed, TC-VHOLD-006 confirms that hold, TC-VHOLD-007 releases the one TC-VHOLD-002 placed, TC-VHOLD-008 uses booking C, and TC-VHOLD-009 uses booking D, held in TC-VHOLD-004. Each case changes the data, so to run any of them again go back to step 1.

---

## Test Cases

### TC-VHOLD-001: Place a hold on a request (AC1, AC3)

**What this tests:** A hold is Venue Staff saying "keep this slot for the coordinator while they finish planning". Here Venue Staff place one on a waiting request (booking A). It should turn into a Tentative Hold that lasts 72 hours, and everyone should be able to see it: Venue Staff in their lists, the coordinator on the event's booking page, and the database (who placed it, when it lapses).

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. Open **Requests** and the **Studio** request for T AM (booking A).
2. Read the **Decision** card, then click **Place hold**.
3. Open **Requests**, then **Decided**.
4. Sign in as `coordinator@test.com`, open the Founders' Gala Dinner and choose **Request a venue**.
5. Read the database:
   ```sql
   select b.status, b.hold_expires_at - now() as time_left, ua.name as decided_by
     from booking b join user_account ua on ua.user_account_id = b.decided_by_user_account_id
    where b.booking_id = <booking A>;
   select action from audit_record where entity_type = 'booking' and entity_id = <booking A> order by audit_record_id;
   ```

**Expected Result:**
- Step 1: the Decision card offers **Approve booking**, **Place hold** and **Reject**.
- Step 2: the card reads "On hold until <day, time> by Test Venue Staff", the header says
  the same, the badge reads **Tentative Hold**, and **Approve booking**, **Place hold** and **Reject** are gone. **Confirm hold** and **Release hold** are offered instead (SPM-219, see TC-VHOLD-006 and 007) (AC1).
- Step 3: booking A has left **Requests** and is listed in **Decided** as "on hold until …" (AC3).
- Step 4: the Studio row on *Booking requests for this event* shows **Tentative Hold** with
  "On hold until …" under it (AC3).
- Step 5: `Tentative Hold`, about 72 hours left (between 71 and 73), decided by Test Venue Staff, and
  one audit row, `hold` (AC1).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-decision-card-with-hold](../screenshots/2026-10-13_TC-VHOLD-001_step1-decision-card-with-hold.png) · [step2-on-hold-card](../screenshots/2026-10-13_TC-VHOLD-001_step2-on-hold-card.png) · [step3-decided-list](../screenshots/2026-10-13_TC-VHOLD-001_step3-decided-list.png) · [step4-coordinator-row](../screenshots/2026-10-13_TC-VHOLD-001_step4-coordinator-row.png)

---

### TC-VHOLD-002: Held slots are taken (AC2, AC3)

**What this tests:** Once a slot is held, nobody else can get it. After booking A holds Studio at T AM, a second request for that same slot (booking B) must be refused, whether Venue Staff try to hold it or approve it, because only one hold or confirmed booking can own a slot. The held slot also disappears from venue search (the coordinator can't find it as free), while a different slot (booking C) is unaffected. Booking B being in the list beside A did not stop A's hold: a request that is merely waiting reserves nothing.

**Preconditions:** After TC-VHOLD-001: booking A is on hold for Studio, T AM. The 9 fixture rows from Setup step 5 are there.

**Steps:**
1. As `coordinator@test.com`, open **Find a venue** (`/staff/coordinator/venues`) and search on T + 3, **AM**.
2. As `venue@test.com`, open the **UAT-44 Harbour Room** request for T + 3 AM (booking G) and click **Place hold**.
3. Search again on T + 3, **AM**.
4. Open the other **Studio** request for T AM (booking B) and click **Place hold**, then **Approve booking**.
5. Open the **Studio** request for T + 1 PM (booking C).

**Expected Result:**
- Step 1: **UAT-44 Harbour Room** is listed.
- Step 3: Harbour Room is no longer listed, because it is already booked in that slot (AC3).
- Step 4: both are refused, naming "T AM" as a date and slot; booking B stays **Requested** and shows no hold (AC2).
- Step 5: booking C is unaffected, still **Requested**, and its slot is free.
- Booking B was **Requested** beside booking A when A was held: a request still waiting
  blocks nothing, so it did not stop the hold (AC2).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-search-lists-harbour-room](../screenshots/2026-10-13_TC-VHOLD-002_step1-search-lists-harbour-room.png) · [step3-search-without-harbour-room](../screenshots/2026-10-13_TC-VHOLD-002_step3-search-without-harbour-room.png) · [step4-second-hold-refused](../screenshots/2026-10-13_TC-VHOLD-002_step4-second-hold-refused.png) · [step5-other-slot-unaffected](../screenshots/2026-10-13_TC-VHOLD-002_step5-other-slot-unaffected.png)

---

### TC-VHOLD-003: A clash or a block refuses the hold and leaves nothing behind (AC2)

**What this tests:** A hold must be refused when the slot cannot be kept, and a refusal must change nothing. Two different reasons are tried. Booking Y wants a slot that booking X has already *Confirmed*, so it is refused as a clash. Booking F wants a slot Venue Staff *blocked* (renovation) after the request was made, so it is refused as unavailable. In both cases the request stays Requested, with no expiry and no audit record, as if nothing had been tried.

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for T + 2 Night (booking Y), beside Confirmed booking X, and click **Place hold**.
2. Open the **Rooftop Terrace** request for T + 6 AM (booking F, whose slot was blocked after the request) and click **Place hold**.
3. Check the database:
   ```sql
   select booking_id, status, hold_expires_at from booking where booking_id in (<booking Y>, <booking F>);
   select entity_id, action from audit_record where entity_type = 'booking' and entity_id in (<booking Y>, <booking F>);
   ```

**Expected Result:**
- Step 1: refused, naming the date T + 2 and "Night"; the booking stays **Requested** (AC2).
- Step 2: refused with "The venue is unavailable for <T + 6> 07:00–12:00" (AC2).
- Step 3: both are `Requested` with no expiry, and no audit rows (AC2).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-clash-with-confirmed](../screenshots/2026-10-13_TC-VHOLD-003_step1-clash-with-confirmed.png) · [step2-blocked-slot](../screenshots/2026-10-13_TC-VHOLD-003_step2-blocked-slot.png)

---

### TC-VHOLD-004: An expired hold does not block, and a live one does (AC2)

**What this tests:** Only a hold that is still running blocks a slot. Main Hall has two holds on day H: the morning one ran out an hour ago (expired), the afternoon one has 30 days left (live). A new hold over the live PM one (booking E) must be refused. A new hold over the expired AM one (booking D) must be accepted, and the old expired hold is then marked Expired, with an audit record, so the slot is free again.

**Preconditions:** The fixture from Setup, with the two holds from the setup (AM expired, PM live). Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for the PM slot on day H (booking E), over the live hold, and click **Place hold**.
2. Open the **Main Hall** request for the AM slot on day H (booking D), over the expired hold, and click **Place hold**.
3. Check the database:
   ```sql
   select b.booking_id, b.status from booking b join booking_slot bs using (booking_id)
    where b.venue_id = (select venue_id from venue where location = 'Main Hall') and bs.slot_date = (now() at time zone 'Asia/Singapore')::date + 21
    order by bs.slot, b.booking_id;
   select entity_id, action from audit_record where action = 'expire hold';
   ```

**Expected Result:**
- Step 1: refused, naming that date and PM; booking E stays **Requested**.
- Step 2: accepted: booking D reads "On hold until …" (AC2).
- Step 3: the expired hold on the AM slot is now `Expired`, with an `expire hold` audit row; the live PM hold is unchanged and booking D is `Tentative Hold` (AC2).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-live-hold-refuses](../screenshots/2026-10-13_TC-VHOLD-004_step1-live-hold-refuses.png) · [step2-expired-hold-does-not-block](../screenshots/2026-10-13_TC-VHOLD-004_step2-expired-hold-does-not-block.png)

---

### TC-VHOLD-005: Only Venue Staff, and only a waiting request (AC1, AC4)

**What this tests:** Who may place a hold, and on what. Only Venue Staff can: the coordinator is turned away with an access-denied page (403) and sees none of the booking, and nothing changes. And only a request still *waiting* can be held: a booking already on hold (booking A) or already Confirmed (booking X) shows no Place hold, Approve booking or Reject button. (A live hold does offer Confirm hold and Release hold, which TC-VHOLD-006 to 008 cover.)

**Preconditions:** After TC-VHOLD-001 (booking A is on hold) and the fixture's Confirmed booking X.

**Steps:**
1. Sign in as `coordinator@test.com` and open `/staff/venue/<booking A>` directly.
2. Sign in as `venue@test.com` and open booking A, then Confirmed booking X.

**Expected Result:**
- Step 1: the access-denied screen with a 403 (SPM-16), and none of the booking's details; nothing changes (AC4).
- Step 2: neither the held booking nor the Confirmed one offers **Place hold**, **Approve booking** or **Reject** (AC1). The held booking offers only **Confirm hold** and **Release hold**; the Confirmed one offers no button.

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-coordinator-denied](../screenshots/2026-10-13_TC-VHOLD-005_step1-coordinator-denied.png) · [step2-confirmed-booking-no-buttons](../screenshots/2026-10-13_TC-VHOLD-005_step2-confirmed-booking-no-buttons.png) · [step2-held-booking-confirm-release-only](../screenshots/2026-10-14_TC-VHOLD-005_step2-held-booking-confirm-release-only.png)

---

### TC-VHOLD-006: Confirm a live hold (AC1, AC3, AC5)

**What this tests:** A hold is temporary. Confirming it makes it a firm booking: the booking becomes **Confirmed**, the hold's expiry disappears, and the slots stay taken. The database records who confirmed and when, and the coordinator is told, exactly as for an approval. Here Venue Staff confirm booking A, the hold placed in TC-VHOLD-001.

**Preconditions:** After TC-VHOLD-001: booking A is on hold for Studio, T AM. Signed in as `venue@test.com`.

**Steps:**
1. Open booking A (`/staff/venue/<booking A>`) and read the **Decision** card.
2. Click **Confirm hold**.
3. Open **Decided**.
4. Open booking B (the other Studio request for T AM) and click **Place hold**.
5. Sign in as `coordinator@test.com`, open the Founders' Gala Dinner and choose **Request a venue**.
6. Read the database:
   ```sql
   select status, hold_expires_at, decided_by_user_account_id from booking where booking_id = <booking A>;
   select action, actor_user_account_id from audit_record where entity_type = 'booking' and entity_id = <booking A> order by audit_record_id;
   select recipient_user_account_id, status, message_content from notification where trigger_scenario = 'venue-booking-decided' and related_booking_id = <booking A>;
   ```

**Expected Result:**
- Step 1: the card reads "On hold until <day, time> by Test Venue Staff" and offers **Confirm hold** and **Release hold**, and no Approve or Reject.
- Step 2: the card reads "Already decided — Confirmed by Test Venue Staff", the badge reads **Confirmed**, and no buttons remain (AC1).
- Step 3: booking A is listed in **Decided** as Confirmed.
- Step 4: refused, naming T and AM. The confirmed booking still owns the slot (AC1).
- Step 5: the Studio row reads **Confirmed**, with no "On hold until" line (AC1).
- Step 6: `Confirmed` with an empty expiry; two audit rows, `hold` then `confirm hold`, the second by Test Venue Staff (AC3); one `Sent` notification for the coordinator, reading "Studio approved for Founders' Gala Dinner", the same as for an approval (AC5).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-hold-offers-confirm-and-release](../screenshots/2026-10-14_TC-VHOLD-006_step1-hold-offers-confirm-and-release.png) · [step2-confirmed](../screenshots/2026-10-14_TC-VHOLD-006_step2-confirmed.png) · [step5-coordinator-row-confirmed](../screenshots/2026-10-14_TC-VHOLD-006_step5-coordinator-row-confirmed.png)

---

### TC-VHOLD-007: Release a live hold (AC2, AC3, AC6)

**What this tests:** Releasing gives a hold up, so its slots go free **at once**: the booking becomes **Released**, venue search lists the venue as available again, and another request can take the slot. The database records who released and when, and the coordinator is told it was released, so they do not keep thinking they hold the venue. Here Venue Staff release booking G, the UAT-44 Harbour Room hold placed in TC-VHOLD-002.

**Preconditions:** After TC-VHOLD-002: booking G is on hold for UAT-44 Harbour Room, T + 3 AM, and Harbour Room is not listed by a search on that slot. Signed in as `venue@test.com`.

**Steps:**
1. Open booking G and click **Release hold**.
2. Open **Archive**.
3. As `coordinator@test.com`, open **Find a venue** (`/staff/coordinator/venues`) and search on T + 3, **AM**.
4. As the coordinator, open the Founders' Gala Dinner, choose **Request a venue**, and request **UAT-44 Harbour Room** on T + 3, **AM**. This is a new request; call it booking G2.
5. As `venue@test.com`, open booking G2 and click **Place hold**.
6. Read the database:
   ```sql
   select status from booking where booking_id = <booking G>;
   select action, actor_user_account_id from audit_record where entity_type = 'booking' and entity_id = <booking G> order by audit_record_id;
   select recipient_user_account_id, status, message_content from notification where trigger_scenario = 'venue-booking-decided' and related_booking_id = <booking G>;
   ```

**Expected Result:**
- Step 1: the card reads "Already decided — Released by Test Venue Staff", the badge reads **Released**, and no buttons remain (AC2).
- Step 2: booking G is listed in **Archive**, not in Requests or Decided.
- Step 3: **UAT-44 Harbour Room** is listed again (AC2).
- Step 5: accepted. Booking G2 reads "On hold until …", because the released slot was free at once (AC2).
- Step 6: `Released`; two audit rows, `hold` then `release hold` (AC3); one `Sent` notification for the coordinator, reading "UAT-44 Harbour Room hold released for Founders' Gala Dinner" (AC6).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-released](../screenshots/2026-10-14_TC-VHOLD-007_step1-released.png) · [step3-search-lists-harbour-room-again](../screenshots/2026-10-14_TC-VHOLD-007_step3-search-lists-harbour-room-again.png) · [step5-new-hold-accepted](../screenshots/2026-10-14_TC-VHOLD-007_step5-new-hold-accepted.png)

---

### TC-VHOLD-008: Only a live hold can be confirmed or released (AC4)

**What this tests:** Confirming or releasing needs a hold that is still running. If it ran out, or was already decided, the action is refused with a message and nothing changes. The sharpest case is a hold that expires **while the page is open**: Venue Staff load the page, the hold runs out, and the click then comes too late. A hold that ran out is expired, so its slots no longer belong to the event.

**Preconditions:** After TC-VHOLD-006: booking A is Confirmed. Booking C (Studio, T + 1 PM) is still **Requested**. Signed in as `venue@test.com`.

**Steps:**
1. Open booking C and click **Place hold**. Leave the page open.
2. Make that hold run out. In the database:
   ```sql
   update booking set hold_expires_at = now() - interval '1 minute' where booking_id = <booking C>;
   ```
3. On the page still open, click **Confirm hold**.
4. Reload the page.
5. Open booking A (Confirmed in TC-VHOLD-006).
6. Open booking B (still Requested).
7. Read the database:
   ```sql
   select status from booking where booking_id = <booking C>;
   select action from audit_record where entity_type = 'booking' and entity_id = <booking C> order by audit_record_id;
   ```

**Expected Result:**
- Step 3: refused with "This hold has expired or already been decided, so it can no longer be confirmed or released."; the booking is not confirmed (AC4).
- Step 4: the card reads "Hold expired <day, time>", the badge reads **Expired**, and no Confirm hold or Release hold is offered (AC4).
- Step 5: booking A, already decided, offers no Confirm hold or Release hold (AC4).
- Step 6: booking B, still waiting, offers Approve, Place hold and Reject, and no Confirm hold or Release hold (AC4).
- Step 7: booking C is `Expired` (it was marked when you reloaded in step 4) and has two audit rows, `hold` then `expire hold`: the refused confirmation wrote nothing (AC4).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step3-refused-after-expiry](../screenshots/2026-10-14_TC-VHOLD-008_step3-refused-after-expiry.png) · [step4-hold-expired](../screenshots/2026-10-14_TC-VHOLD-008_step4-hold-expired.png) · [step5-confirmed-offers-neither](../screenshots/2026-10-14_TC-VHOLD-008_step5-confirmed-offers-neither.png)

---

### TC-VHOLD-009: A block recorded after the hold stops it being confirmed (AC7)

**What this tests:** Confirming commits the slots, just as an approval does, and a venue that is blocked (maintenance, renovation) cannot be committed. So if Venue Staff block a venue **after** a hold was placed on it, confirming that hold is refused, as approving a request over a block is. The hold is left as it was. Releasing is still allowed, because giving a hold up needs nothing free. Here the hold is booking D, placed in TC-VHOLD-004 on Main Hall, day H, AM.

**Preconditions:** After TC-VHOLD-004: booking D is on hold for Main Hall, day H, AM. Signed in as `venue@test.com`.

**Steps:**
1. Open `/staff/venue/unavailability` and block **Main Hall** on day H from **07:00** to **12:00**, reason **Maintenance**.
2. Open booking D and read the **Decision** card.
3. Click **Confirm hold**.
4. Click **Release hold**.
5. Read the database:
   ```sql
   select status from booking where booking_id = <booking D>;
   select action from audit_record where entity_type = 'booking' and entity_id = <booking D> order by audit_record_id;
   ```

**Expected Result:**
- Step 2: the card still reads "On hold until …" and offers **Confirm hold** and **Release hold**: a block does not change an existing hold.
- Step 3: refused with "The venue is unavailable for <day H> 07:00–12:00. Choose other times or another venue."; booking D stays on hold (AC7).
- Step 4: accepted: the card reads "Already decided — Released by Test Venue Staff" (AC7).
- Step 5: `Released`; the audit rows are `hold` then `release hold`, with no `confirm hold`: the refused confirmation wrote nothing (AC7).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step3-confirm-refused-over-block](../screenshots/2026-10-14_TC-VHOLD-009_step3-confirm-refused-over-block.png) · [step4-released-over-block](../screenshots/2026-10-14_TC-VHOLD-009_step4-released-over-block.png)

---

### TC-VHOLD-010: A hold that ran out reads Expired and moves to Archive (AC1, AC2, AC4, AC5, AC6)

**What this tests:** When a hold runs out unconfirmed it stops being a hold. It reads **Expired** (not Tentative Hold), moves from **Decided** to **Archive**, and is never shown as Confirmed. Its slots are free at once for someone else. Its expiry stays on record, and exactly one audit row says it **expired** (not that a person released it). There is no timer, so a hold is marked the next time it is read. Booking C, whose hold ran out in TC-VHOLD-008, is the example.

**Preconditions:** After TC-VHOLD-008: booking C's hold has an expiry in the past and was marked when its page was reloaded. Signed in as `venue@test.com`.

**Steps:**
1. Open **Decided**.
2. Open **Archive**, then open booking C.
3. Reload booking C's page twice.
4. As `coordinator@test.com`, open the Founders' Gala Dinner, choose **Request a venue**, and read the Studio row for T + 1 PM.
5. As the coordinator, request **Studio** on T + 1, **PM** again from the same page. This is a new request; call it booking C2. As `venue@test.com`, open booking C2 and click **Place hold**.
6. Read the database:
   ```sql
   select status, hold_expires_at from booking where booking_id = <booking C>;
   select action, actor_user_account_id from audit_record where entity_type = 'booking' and entity_id = <booking C> order by audit_record_id;
   ```

**Expected Result:**
- Step 1: booking C is not listed in **Decided** (AC6).
- Step 2: booking C is listed in **Archive**; the card reads "Hold expired <day, time>", the badge reads **Expired**, and no buttons are offered (AC1, AC6).
- Step 3: nothing changes.
- Step 4: the row reads **Expired**, with no "On hold until" line, and is not shown as Confirmed (AC4, AC6).
- Step 5: the new request is accepted and its hold is accepted: booking C2 reads "On hold until …", because the expired hold freed the slot (AC2).
- Step 6: `Expired`, with the expiry still set to the moment it ran out; the audit rows are `hold` then `expire hold`, **one** `expire hold` however many times it was read, with no actor because time did it (AC5).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-expired-in-archive](../screenshots/2026-10-17_TC-VHOLD-010_step2-expired-in-archive.png) · [step4-coordinator-row-expired](../screenshots/2026-10-17_TC-VHOLD-010_step4-coordinator-row-expired.png) · [step5-new-hold-accepted](../screenshots/2026-10-17_TC-VHOLD-010_step5-new-hold-accepted.png)

---

### TC-VHOLD-011: A hold is capped at its slot's start (AC7)

**What this tests:** A hold lasts 72 hours or until its slot starts, whichever comes first, because a hold that outlives its slot means nothing. So a hold on a slot that starts tomorrow at 1 pm expires at 1 pm tomorrow, not 72 hours from now, and a hold on a slot that has already started is refused.

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. As `coordinator@test.com`, open the Founders' Gala Dinner, choose **Request a venue**, and request **Studio** for **tomorrow** (Singapore date), **PM**. Call it booking Z.
2. As `venue@test.com`, open booking Z and click **Place hold**.
3. Read the database:
   ```sql
   select hold_expires_at at time zone 'Asia/Singapore' from booking where booking_id = <booking Z>;
   ```
4. Make a slot that has already started: set booking E's slot to yesterday.
   ```sql
   update booking_slot set slot_date = (now() at time zone 'Asia/Singapore')::date - 1 where booking_id = <booking E>;
   ```
5. Open booking E and click **Place hold**.

**Expected Result:**
- Step 2: accepted: the card reads "On hold until <tomorrow>, 1:00 pm" (AC7).
- Step 3: tomorrow at 13:00:00, the PM slot's start, and not 72 hours from now (AC7).
- Step 5: refused with "A hold can't be placed on a slot that has already started."; booking E stays **Requested** and has no audit row (AC7).

**Status:** [x] Pass [ ] Fail — 17/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step2-hold-capped-at-slot-start](../screenshots/2026-10-17_TC-VHOLD-011_step2-hold-capped-at-slot-start.png) · [step5-started-slot-refused](../screenshots/2026-10-17_TC-VHOLD-011_step5-started-slot-refused.png)

---

### TC-VHOLD-012: The coordinator is told when a hold expires (SPM-254 AC1, AC2)

**What this tests:** When a hold runs out unconfirmed, the event's coordinator gets one Inbox notice saying so. It names the venue, the held slot and when the hold expired, and says the venue is no longer held. There is no timer: the notice goes out after the next staff page loads, whoever loads it. The setup's live PM hold on *Holds Test Event* is the example.

**Preconditions:** The fixture from Setup. The app runs with Novu reachable (`NOVU_BRIDGE_URL` set to a `novu dev` tunnel); without it the notice is only recorded, so steps 3 and 4 cannot be checked. Signed in as `venue@test.com` in one window and `coordinator@test.com` in another.

**Steps:**
1. Make the PM hold lapse:
   ```sql
   update booking set hold_expires_at = now() - interval '1 minute'
   where status = 'Tentative Hold'
     and event_id = (select event_id from event where name = 'Holds Test Event');
   ```
2. As `venue@test.com`, open **Decided**.
3. As `coordinator@test.com`, open the Inbox.
4. Click the notice.
5. Read the database:
   ```sql
   select n.recipient_user_account_id, n.status, n.message_content, b.expiry_notified_at
   from notification n join booking b on b.booking_id = n.related_booking_id
   where n.trigger_scenario = 'hold-expired'
     and b.event_id = (select event_id from event where name = 'Holds Test Event');
   ```

**Expected Result:**
- Step 2: the page loads as usual; the PM hold is no longer listed under **Decided**.
- Step 3: one notice, "Main Hall hold expired for Holds Test Event", reading "The hold on Main Hall for <day H> (PM) expired at <today, time> without being confirmed. The venue is no longer held; send a new request if you still need it." (AC1, AC2).
- Step 4: it opens the event.
- Step 5: one row per expired hold of the event, addressed to the Test Coordinator, `Sent`, with `expiry_notified_at` set (AC1).

**Status:** [ ] Pass [ ] Fail

**Screenshots:** [step2-holds-gone-from-decided](../screenshots/2026-10-18_TC-VHOLD-012_step2-holds-gone-from-decided.png)

---

### TC-VHOLD-013: Each expired hold is told once (SPM-254 AC3)

**What this tests:** However many staff pages load after a hold expires, and whoever loads them, the coordinator hears about it once. A hold that had already expired before this feature shipped is never announced.

**Preconditions:** After TC-VHOLD-012. Signed in as `venue@test.com` and `coordinator@test.com`.

**Steps:**
1. As `venue@test.com`, open **Decided**, **Archive** and **Requests**, and reload each.
2. As `coordinator@test.com`, open any two pages and reload them.
3. Read the database:
   ```sql
   select related_booking_id, count(*) from notification
   where trigger_scenario = 'hold-expired' group by related_booking_id;
   ```
4. Open the coordinator's Inbox.

**Expected Result:**
- Step 3: every booking has exactly **1** row (AC3).
- Step 4: no new hold-expired notice since TC-VHOLD-012 (AC3).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**
