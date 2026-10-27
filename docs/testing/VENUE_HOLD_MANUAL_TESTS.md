# Venue Hold Manual Tests (SPM-218, SPM-219, SPM-253, SPM-254, SPM-325)

> **SPM-459:** the coordinator's *Request a venue* page is now the **Venue** tab of the
> event page, `/staff/coordinator/events/<event id>?tab=venue`. Where a case below says
> *Request a venue*, use that tab. *My events* → **Request a venue** opens it, and the old
> `/staff/coordinator/<request id>/venue-booking` URL redirects there.

> **SPM-325:** a booking is a start and end time on each date, on the 15-minute grid (SPM-324),
> and approving or holding counts each venue's setup and turnaround time (SPM-19). These cases
> were rewritten in times on 27 Oct 2026. The runs ticked before then used AM, PM and Night; they
> are in the git history.

## Overview

Browser checks for **SPM-218: Place a tentative hold on a venue slot**, **SPM-219: Confirm or
release a tentative hold**, **SPM-253: Expire an unconfirmed hold** and **SPM-254: Warn the coordinator of hold expiry**. Venue
Staff place a hold on a booking request while the Event Coordinator is
finalising the event. The hold keeps the request's times from everyone else for
72 hours (`DEFAULT_HOLD_HOURS`), or until its earliest time starts if that is sooner, and then lapses to
**Expired** (SPM-253). The rules behind it
are unit-tested (`decideBooking placing a hold (SPM-218)` and the use case, mapper and
repository tests tagged SPM-218) and the database function was proven on a scratch
Postgres; these cases check the pages end to end against Supabase.

These cases are registered as `TC-VHOLD-001`–`TC-VHOLD-014` in
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
3. Add the two holds at Main Hall on day **H**, 21 days from today (07:00–12:00 expired an hour
   ago, 14:00–18:00 expiring in thirty days). They belong to their own event, *Holds Test Event*:
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
   supabase db query --local "select b.booking_id, v.location, bs.slot_date, min(sl.start_time) as starts, max(sl.end_time) as ends, b.status from booking b join venue v on v.venue_id = b.venue_id join booking_slot bs on bs.booking_id = b.booking_id join slot sl on sl.slot_code = bs.slot where b.event_id = (select event_id from event where name = 'Founders'' Gala Dinner') group by b.booking_id, v.location, bs.slot_date, b.status order by b.booking_id"
   ```
   Note the nine booking ids. In id order they are **A, B, C, X, Y, D, E, F, G** (the table below).
   The cases write `<booking A>` where you put A's id.
6. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>. Venue Staff is
   `venue@test.com`, the coordinator is `coordinator@test.com`; the password for both is `TestPass123!`.

### The days and the bookings

**T** is 14 days from today and **H** is 21 days from today, both in Singapore time. Venue search
looks 60 days ahead, so it can still see T.

| In id order | Booking | Venue | Day, times | Status | Used in |
| --- | --- | --- | --- | --- | --- |
| 1st | A | Studio | T, 07:00–12:00 | Requested | held in TC-VHOLD-001 |
| 2nd | B | Studio | T, 07:00–12:00 | Requested | same times as A, refused in TC-VHOLD-002 |
| 3rd | C | Studio | T + 1, 13:00–18:00 | Requested | other times, unaffected, TC-VHOLD-002 |
| 4th | X | Main Hall | T + 2, 19:00–24:00 | Confirmed | already confirmed, TC-VHOLD-003 and 005 |
| 5th | Y | Main Hall | T + 2, 19:00–24:00 | Requested | same times as X, refused in TC-VHOLD-003 |
| 6th | D | Main Hall | H, 07:00–12:00 | Requested | over the expired hold, TC-VHOLD-004 |
| 7th | E | Main Hall | H, 14:00–18:00 | Requested | over the live hold, TC-VHOLD-004 |
| 8th | F | Rooftop Terrace | T + 6, 07:00–12:00 | Requested | its times blocked after the request, TC-VHOLD-003 |
| 9th | G | UAT-44 Harbour Room | T + 3, 07:00–12:00 | Requested | held, then searched for, TC-VHOLD-002 |

Main Hall has 30 minutes' setup and 45 minutes' turnaround, so a refusal there names the padded
times: the live hold on day H keeps the room 13:30–18:45, and booking X keeps it from 18:30 on
T + 2 to 00:45 on T + 3. Studio has none, and Rooftop Terrace and Harbour Room have none set. A
refusal by another booking reads "This booking is blocked by the following event:", then one
line per date, "• <event> on <date> (<start>–<end>, incl. setup & turnaround)", with ": already
temporarily reserved (held), the hold expires on <date time> (Singapore time)" after it when that
booking is a hold.

Only the two UAT venues have a booking horizon recorded, so only they can be found by a
date-and-time search. Open any booking as `/staff/venue/<booking id>`, or from **Requests** and
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

**What this tests:** A hold is Venue Staff saying "keep these times for the coordinator while they finish planning". Here Venue Staff place one on a waiting request (booking A). It should turn into a Tentative Hold that lasts 72 hours, keep the booking's times, and everyone should be able to see it: Venue Staff in their lists, the coordinator on the event's booking page, and the database (who placed it, when it lapses).

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. Open **Requests** and the **Studio** request for T 07:00–12:00 (booking A).
2. Read the **Decision** card, then click **Place hold**.
3. Open **Requests**, then **Decided**.
4. Sign in as `coordinator@test.com`, open the Founders' Gala Dinner and choose **Request a venue**.
5. Read the database:
   ```sql
   select b.status, b.hold_expires_at - now() as time_left, ua.name as decided_by
     from booking b join user_account ua on ua.user_account_id = b.decided_by_user_account_id
    where b.booking_id = <booking A>;
   select min(sl.start_time), max(sl.end_time), count(*) from booking_slot bs join slot sl on sl.slot_code = bs.slot
    where bs.booking_id = <booking A>;
   select action from audit_record where entity_type = 'booking' and entity_id = <booking A> order by audit_record_id;
   ```

**Expected Result:**
- Step 1: the Decision card offers **Approve booking**, **Place hold** and **Reject**.
- Step 2: the card reads "On hold until <day, time> by Test Venue Staff", the header says
  the same, the badge reads **Tentative Hold**, and **Approve booking**, **Place hold** and **Reject** are gone. **Confirm hold** and **Release hold** are offered instead (SPM-219, see TC-VHOLD-006 and 007) (AC1).
- Step 3: booking A has left **Requests** and is listed in **Decided** as "on hold until …", reading 07:00–12:00 (AC3).
- Step 4: the Studio row on *Booking requests for this event* shows **Tentative Hold** with
  "On hold until …" under it, and the times 07:00–12:00 (AC3).
- Step 5: `Tentative Hold`, about 72 hours left (between 71 and 73), decided by Test Venue Staff; the
  booking still holds 07:00 to 12:00 in 20 slots, the times it was requested for (SPM-325 AC2); and
  one audit row, `hold` (AC1).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-002: Held times are taken (AC2, AC3)

**What this tests:** Once times are held, nobody else can get them. After booking A holds Studio at T 07:00–12:00, a second request for those same times (booking B) must be refused, whether Venue Staff try to hold it or approve it, because only one hold or confirmed booking can own a time. The refusal names the event in the way and the date and times. The held times also disappear from venue search (the coordinator can't find them as free), while other times (booking C) are unaffected. Booking B being in the list beside A did not stop A's hold: a request that is merely waiting reserves nothing.

**Preconditions:** After TC-VHOLD-001: booking A is on hold for Studio, T 07:00–12:00. The 9 fixture rows from Setup step 5 are there.

**Steps:**
1. As `coordinator@test.com`, open **Find a venue** (`/staff/coordinator/venues`) and search on **Date** T + 3, **Start time** 07:00, **End time** 12:00.
2. As `venue@test.com`, open the **UAT-44 Harbour Room** request for T + 3 07:00–12:00 (booking G) and click **Place hold**.
3. Search again on T + 3, 07:00 to 12:00.
4. Open the other **Studio** request for T 07:00–12:00 (booking B) and click **Place hold**, then **Approve booking**.
5. Open the **Studio** request for T + 1 13:00–18:00 (booking C).

**Expected Result:**
- Step 1: **UAT-44 Harbour Room** is listed.
- Step 3: Harbour Room is no longer listed, because it is already booked at those times (AC3).
- Step 4: both are refused with "This booking is blocked by the following event:" and one line,
  "• Founders' Gala Dinner on <T> (07:00–12:00, incl. setup & turnaround): already temporarily
  reserved (held), the hold expires on <date time> (Singapore time)". Booking B stays **Requested** and shows no hold (AC2).
- Step 5: booking C is unaffected, still **Requested**, and its times are free.
- Booking B was **Requested** beside booking A when A was held: a request still waiting
  blocks nothing, so it did not stop the hold (AC2).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-003: A clash or a block refuses the hold and leaves nothing behind (AC2)

**What this tests:** A hold must be refused when its times cannot be kept, and a refusal must change nothing. Two different reasons are tried. Booking Y wants times that booking X has already *Confirmed* at Main Hall, so it is refused as a clash, naming X's event and the times counting Main Hall's setup and turnaround. Booking F wants times Venue Staff *blocked* (renovation) after the request was made, so it is refused as unavailable. In both cases the request stays Requested, with no expiry and no audit record, as if nothing had been tried.

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for T + 2 19:00–24:00 (booking Y), beside Confirmed booking X, and click **Place hold**.
2. Open the **Rooftop Terrace** request for T + 6 07:00–12:00 (booking F, whose times were blocked after the request) and click **Place hold**.
3. Check the database:
   ```sql
   select booking_id, status, hold_expires_at from booking where booking_id in (<booking Y>, <booking F>);
   select entity_id, action from audit_record where entity_type = 'booking' and entity_id in (<booking Y>, <booking F>);
   ```

**Expected Result:**
- Step 1: refused with "This booking is blocked by the following event:" and two lines, one per date:
  "• Founders' Gala Dinner on <T + 2> (18:30–24:00, incl. setup & turnaround)" and
  "• Founders' Gala Dinner on <T + 3> (00:00–00:45, incl. setup & turnaround)". The booking stays **Requested** (AC2).
- Step 2: refused with "The venue is unavailable for <T + 6> 07:00–12:00. Choose other times or another venue." (AC2).
- Step 3: both are `Requested` with no expiry, and no audit rows (AC2).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-004: An expired hold does not block, and a live one does (AC2)

**What this tests:** Only a hold that is still running blocks its times. Main Hall has two holds on day H: the 07:00–12:00 one ran out an hour ago (expired), the 14:00–18:00 one has 30 days left (live). A new hold over the live one (booking E) must be refused. A new hold over the expired one (booking D) must be accepted, and the old expired hold is then marked Expired, with an audit record, so its times are free again. D's padded window (06:30–12:45) ends before the live hold's begins (13:30), so the live hold does not stop it.

**Preconditions:** The fixture from Setup, with the two holds from the setup (07:00–12:00 expired, 14:00–18:00 live). Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for day H 14:00–18:00 (booking E), over the live hold, and click **Place hold**.
2. Open the **Main Hall** request for day H 07:00–12:00 (booking D), over the expired hold, and click **Place hold**.
3. Check the database:
   ```sql
   select b.booking_id, e.name as event, min(sl.start_time) as starts, max(sl.end_time) as ends, b.status
     from booking b join event e on e.event_id = b.event_id
     join booking_slot bs on bs.booking_id = b.booking_id join slot sl on sl.slot_code = bs.slot
    where b.venue_id = (select venue_id from venue where location = 'Main Hall')
      and bs.slot_date = (now() at time zone 'Asia/Singapore')::date + 21
    group by b.booking_id, e.name, b.status order by starts, b.booking_id;
   select entity_id, action from audit_record where action = 'expire hold';
   ```

**Expected Result:**
- Step 1: refused with "This booking is blocked by the following event:" and "• Holds Test Event on <day H>
  (13:30–18:45, incl. setup & turnaround): already temporarily reserved (held), the hold expires on <date time> (Singapore time)"; booking E stays **Requested**.
- Step 2: accepted: booking D reads "On hold until …" (AC2).
- Step 3: the expired 07:00–12:00 hold is now `Expired`, with an `expire hold` audit row; the live 14:00–18:00 hold is unchanged and booking D is `Tentative Hold` (AC2).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

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

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-006: Confirm a live hold (AC1, AC3, AC5)

**What this tests:** A hold is temporary. Confirming it makes it a firm booking: the booking becomes **Confirmed**, the hold's expiry disappears, and its times stay taken. The database records who confirmed and when, and the coordinator is told, exactly as for an approval, with the venue, the date and the times. Here Venue Staff confirm booking A, the hold placed in TC-VHOLD-001.

**Preconditions:** After TC-VHOLD-001: booking A is on hold for Studio, T 07:00–12:00. Signed in as `venue@test.com`.

**Steps:**
1. Open booking A (`/staff/venue/<booking A>`) and read the **Decision** card.
2. Click **Confirm hold**.
3. Open **Decided**.
4. Open booking B (the other Studio request for T 07:00–12:00) and click **Place hold**.
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
- Step 4: refused with "• Founders' Gala Dinner on <T> (07:00–12:00, incl. setup & turnaround)", with no "held" after it. The confirmed booking still owns its times (AC1).
- Step 5: the Studio row reads **Confirmed**, with no "On hold until" line (AC1).
- Step 6: `Confirmed` with an empty expiry; two audit rows, `hold` then `confirm hold`, the second by Test Venue Staff (AC3); one `Sent` notification for the coordinator, "Studio approved for Founders' Gala Dinner", whose text reads "Venue Staff confirmed Studio for <T, e.g. Tue, 10 Nov 2026> (07:00–12:00). The venue is secured.", the same as for an approval and with no AM, PM or Night (AC5; SPM-325 AC5).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-007: Release a live hold (AC2, AC3, AC6)

**What this tests:** Releasing gives a hold up, so its times go free **at once**: the booking becomes **Released**, venue search lists the venue as available again, and another request can take the times. The database records who released and when, and the coordinator is told it was released, naming the venue, date and times, so they do not keep thinking they hold the venue. Here Venue Staff release booking G, the UAT-44 Harbour Room hold placed in TC-VHOLD-002.

**Preconditions:** After TC-VHOLD-002: booking G is on hold for UAT-44 Harbour Room, T + 3 07:00–12:00, and Harbour Room is not listed by a search on those times. Signed in as `venue@test.com`.

**Steps:**
1. Open booking G and click **Release hold**.
2. Open **Archive**.
3. As `coordinator@test.com`, open **Find a venue** (`/staff/coordinator/venues`) and search on T + 3, 07:00 to 12:00.
4. As the coordinator, open the Founders' Gala Dinner, choose **Request a venue**, and request **UAT-44 Harbour Room** on T + 3, 07:00 to 12:00. This is a new request; call it booking G2.
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
- Step 4: the request is sent: the released times were free at once.
- Step 5: accepted. Booking G2 reads "On hold until …" (AC2).
- Step 6: `Released`; two audit rows, `hold` then `release hold` (AC3); one `Sent` notification for the coordinator, "UAT-44 Harbour Room hold released for Founders' Gala Dinner", whose text reads "Venue Staff released the hold on UAT-44 Harbour Room for <T + 3> (07:00–12:00). The times are free for other events; send a new request if you still need them." (AC6; SPM-325 AC5).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-008: Only a live hold can be confirmed or released (AC4)

**What this tests:** Confirming or releasing needs a hold that is still running. If it ran out, or was already decided, the action is refused with a message and nothing changes. The sharpest case is a hold that expires **while the page is open**: Venue Staff load the page, the hold runs out, and the click then comes too late. A hold that ran out is expired, so its times no longer belong to the event.

**Preconditions:** After TC-VHOLD-006: booking A is Confirmed. Booking C (Studio, T + 1 13:00–18:00) is still **Requested**. Signed in as `venue@test.com`.

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

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-009: A block recorded after the hold stops it being confirmed (AC7)

**What this tests:** Confirming commits the times, just as an approval does, and a venue that is blocked (maintenance, renovation) cannot be committed. So if Venue Staff block a venue **after** a hold was placed on it, confirming that hold is refused, as approving a request over a block is. The hold is left as it was. Releasing is still allowed, because giving a hold up needs nothing free. Here the hold is booking D, placed in TC-VHOLD-004 on Main Hall, day H, 07:00–12:00.

**Preconditions:** After TC-VHOLD-004: booking D is on hold for Main Hall, day H, 07:00–12:00. Signed in as `venue@test.com`.

**Steps:**
1. Open `/staff/venue/unavailability` and block **Main Hall** on day H from **09:00** to **10:00**, reason **Maintenance**.
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
- Step 3: refused with "The venue is unavailable for <day H> 09:00–10:00. Choose other times or another venue."; booking D stays on hold (AC7; SPM-325 AC3).
- Step 4: accepted: the card reads "Already decided — Released by Test Venue Staff" (AC7; SPM-325 AC3).
- Step 5: `Released`; the audit rows are `hold` then `release hold`, with no `confirm hold`: the refused confirmation wrote nothing (AC7).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-010: A hold that ran out reads Expired and moves to Archive (AC1, AC2, AC4, AC5, AC6)

**What this tests:** When a hold runs out unconfirmed it stops being a hold. It reads **Expired** (not Tentative Hold), moves from **Decided** to **Archive**, and is never shown as Confirmed. Its times are free at once for someone else. Its expiry stays on record, and exactly one audit row says it **expired** (not that a person released it). There is no timer, so a hold is marked the next time it is read. Booking C, whose hold ran out in TC-VHOLD-008, is the example.

**Preconditions:** After TC-VHOLD-008: booking C's hold has an expiry in the past and was marked when its page was reloaded. Signed in as `venue@test.com`.

**Steps:**
1. Open **Decided**.
2. Open **Archive**, then open booking C.
3. Reload booking C's page twice.
4. As `coordinator@test.com`, open the Founders' Gala Dinner, choose **Request a venue**, and read the Studio row for T + 1 13:00–18:00.
5. As the coordinator, request **Studio** on T + 1, 13:00 to 18:00 again from the same page. This is a new request; call it booking C2. As `venue@test.com`, open booking C2 and click **Place hold**.
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
- Step 5: the new request is accepted and its hold is accepted: booking C2 reads "On hold until …", because the expired hold freed the times (AC2).
- Step 6: `Expired`, with the expiry still set to the moment it ran out; the audit rows are `hold` then `expire hold`, **one** `expire hold` however many times it was read, with no actor because time did it (AC5).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-011: A hold is capped at its earliest start time (AC7)

**What this tests:** A hold lasts 72 hours or until the start of its earliest booked time, whichever comes first, because a hold that outlives its time means nothing. So a hold on times that start tomorrow at 1 pm expires at 1 pm tomorrow, not 72 hours from now, and a hold on times that have already started is refused (SPM-325 AC4).

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. As `coordinator@test.com`, open the Founders' Gala Dinner, choose **Request a venue**, and request **Studio** for **tomorrow** (Singapore date), 13:00 to 18:00. Call it booking Z.
2. As `venue@test.com`, open booking Z and click **Place hold**.
3. Read the database:
   ```sql
   select hold_expires_at at time zone 'Asia/Singapore' from booking where booking_id = <booking Z>;
   ```
4. Make times that have already started: move booking E's date to yesterday.
   ```sql
   update booking_slot set slot_date = (now() at time zone 'Asia/Singapore')::date - 1 where booking_id = <booking E>;
   ```
5. Open booking E and click **Place hold**.

**Expected Result:**
- Step 2: accepted: the card reads "On hold until <tomorrow>, 1:00 pm" (AC7).
- Step 3: tomorrow at 13:00:00, the start of its time, and not 72 hours from now (AC7).
- Step 5: refused with "A hold can't be placed on a slot that has already started."; booking E stays **Requested** and has no audit row (AC7).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

---

### TC-VHOLD-012: The coordinator is told when a hold expires (SPM-254 AC1, AC2)

**What this tests:** When a hold runs out unconfirmed, the event's coordinator gets one Inbox notice saying so. It names the venue, the held date and times and when the hold expired, and says the venue is no longer held. There is no timer: the notice goes out after the next staff page loads, whoever loads it. The setup's live 14:00–18:00 hold on *Holds Test Event* is the example.

**Preconditions:** The fixture from Setup. The app runs with Novu reachable (`NOVU_BRIDGE_URL` set to a `novu dev` tunnel); without it the notice is only recorded, so steps 3 and 4 cannot be checked. Signed in as `venue@test.com` in one window and `coordinator@test.com` in another.

**Steps:**
1. Make the 14:00–18:00 hold lapse:
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
- Step 2: the page loads as usual; the hold is no longer listed under **Decided**.
- Step 3: one notice, "Main Hall hold expired for Holds Test Event", reading "The hold on Main Hall for <day H, e.g. Tue, 17 Nov 2026> (14:00–18:00) expired at <today, time> without being confirmed. The venue is no longer held; send a new request if you still need it." (AC1, AC2; SPM-325 AC5).
- Step 4: it opens the event.
- Step 5: one row per expired hold of the event, addressed to the Test Coordinator, `Sent`, with `expiry_notified_at` set (AC1).

**Status:** [ ] Pass [ ] Fail

**Screenshots:**

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

---

### TC-VHOLD-014: The database keeps the approval and hold rules by time (SPM-325 AC1, AC2, AC3)

**What this tests:** The rules the pages rely on, checked straight against the database functions, so they hold however the functions are called. A refused approval leaves the request to be rejected; a request still waiting blocks no hold; confirming a hold keeps its times taken and releasing frees them at once; and a block recorded after a hold stops it being confirmed but not released. Each case is built and rolled back, so nothing is kept. The padded refusals are checked by TC-VPAD-007.

**Preconditions:** A local stack reset and loaded with `seed-coordinator-view`, `seed-venues` and `seed-venue-search-uat` (Setup steps 1 and 2 are enough). The fixture is not needed.

**Steps:**
1. Run:
   ```bash
   supabase db query --file scripts/seed-booking-holds/checks.sql --local
   ```

**Expected Result:**
- Step 1: it ends `error: ok: all 7 checks held`. The CLI words this "failed to execute query"; the script ends in an error on purpose, so everything it wrote rolls back, and the `ok:` is the pass.

**Status:** [ ] Pass [ ] Fail

**Screenshots:** none (database checks)
