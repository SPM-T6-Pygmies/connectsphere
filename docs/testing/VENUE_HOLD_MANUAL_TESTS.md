# Venue Hold Manual Tests (SPM-218)

## Overview

Browser checks for **SPM-218: Place a tentative hold on a venue slot**. Venue
Staff place a hold on a booking request while the Event Coordinator is
finalising the event. The hold keeps the request's slots from everyone else for
72 hours (`DEFAULT_HOLD_HOURS`), and then lapses (SPM-253). The rules behind it
are unit-tested (`decideBooking placing a hold (SPM-218)` and the use case, mapper and
repository tests tagged SPM-218) and the database function was proven on a scratch
Postgres; these cases check the pages end to end against Supabase.

These cases are registered as `TC-VHOLD-001`–`TC-VHOLD-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the
PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.
The ticked boxes and screenshots below are the working record for this run.

Confirming or releasing a hold is SPM-219, and a hold lapsing is SPM-253, so no case
here confirms, releases or waits out a hold. A held booking is listed under **Decided**,
beside Confirmed ones; the list filters did not change.

## Setup

1. `supabase db reset`, then load the data as the Single Source of Truth lists it
   ([Set up your database](../../scripts/README.md#1-set-up-your-database), Steps 1 and 2):
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-equipment/seed.sql --local
   ```
2. Add the two holds at Main Hall three weeks from today (AM expired an hour ago, PM expiring in
   thirty days). They belong to their own event, *Holds Test Event*:
   ```bash
   supabase db query --file scripts/seed-booking-holds/seed.sql --local
   ```
3. `pnpm dev:local`. Venue Staff is `venue@test.com`, the coordinator is
   `coordinator@test.com` (password `TestPass123!` for both).

### Fixture

Nine booking requests for the Founders' Gala Dinner, all waiting for Venue Staff except
one Confirmed booking, and a block on Rooftop Terrace recorded after its request. **D is 14
days from today, Singapore time**, so venue search (60 days ahead) can still see it. Run it
once after the setup above (it adds rows each time, so reset to run it again):

```sql
do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Founders'' Gala Dinner');
  v_coord bigint := (select user_account_id from public.user_account where name = 'Test Coordinator');
  v_staff bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_id bigint;
  d date := (now() at time zone 'Asia/Singapore')::date + 14;
  r record;
begin
  for r in
    select * from (values
      ('Studio',          d,     'AM',    'Requested'),   -- A: held in TC-VHOLD-001
      ('Studio',          d,     'AM',    'Requested'),   -- B: same slot as A, refused in TC-VHOLD-002
      ('Studio',          d + 1, 'PM',    'Requested'),   -- C: a different slot, unaffected
      ('Main Hall',       d + 2, 'Night', 'Confirmed'),   -- X: already confirmed
      ('Main Hall',       d + 2, 'Night', 'Requested'),   -- Y: same slot as X, refused in TC-VHOLD-003
      ('Main Hall',       current_date + 21, 'AM',    'Requested'),   -- D: over the expired hold, TC-VHOLD-004
      ('Main Hall',       current_date + 21, 'PM',    'Requested'),   -- E: over the live hold, TC-VHOLD-004
      ('Rooftop Terrace', d + 6, 'AM',    'Requested'),   -- F: blocked afterwards, TC-VHOLD-003
      ('UAT-44 Harbour Room', d + 3, 'AM', 'Requested')   -- G: held, then searched for, TC-VHOLD-002
    ) as t(venue, d, slot, status)
  loop
    insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
    values ((select venue_id from public.venue where location = r.venue), v_event, v_coord,
            case when r.status = 'Requested' then null else v_staff end, r.status)
    returning booking_id into v_id;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_id, r.d, r.slot);
  end loop;

  perform public.venue_staff_record_unavailability(
    v_staff, (select venue_id from public.venue where location = 'Rooftop Terrace'), 'Renovation', null,
    jsonb_build_array(jsonb_build_object('date', d + 6, 'slot', 'AM')));
end $$;
```

The bookings below are labelled A to G, X and Y as in the comments. Only the two UAT venues have
slots and a booking horizon recorded, so only they can be found by a date-and-slot search. Open any
booking as `/staff/venue/<booking id>`, or from **Requests** and **Decided** on the left.

---

## Test Cases

### TC-VHOLD-001: Place a hold on a request (AC1, AC3)

**Preconditions:** The fixture above. Signed in as `venue@test.com`.

**Steps:**
1. Open **Requests** and the **Studio** request for D AM (booking A).
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
  the same, the badge reads **Tentative Hold**, and no decision buttons remain (AC1).
- Step 3: booking A has left **Requests** and is listed in **Decided** as "on hold until …" (AC3).
- Step 4: the Studio row on *Booking requests for this event* shows **Tentative Hold** with
  "On hold until …" under it (AC3).
- Step 5: `Tentative Hold`, about 72 hours left (between 71 and 73), decided by Test Venue Staff, and
  one audit row, `hold` (AC1).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-decision-card-with-hold](../screenshots/2026-10-13_TC-VHOLD-001_step1-decision-card-with-hold.png) · [step2-on-hold-card](../screenshots/2026-10-13_TC-VHOLD-001_step2-on-hold-card.png) · [step3-decided-list](../screenshots/2026-10-13_TC-VHOLD-001_step3-decided-list.png) · [step4-coordinator-row](../screenshots/2026-10-13_TC-VHOLD-001_step4-coordinator-row.png)

---

### TC-VHOLD-002: Held slots are taken (AC2, AC3)

**Preconditions:** After TC-VHOLD-001: booking A is on hold for Studio, D AM.

**Steps:**
1. As `coordinator@test.com`, open **Find a venue** and search on D + 3, **AM**.
2. As `venue@test.com`, open the **UAT-44 Harbour Room** request for D + 3 AM (booking G) and click **Place hold**.
3. Search again on D + 3, **AM**.
4. Open the other **Studio** request for D AM (booking B) and click **Place hold**, then **Approve booking**.
5. Open the **Studio** request for D + 1 PM (booking C).

**Expected Result:**
- Step 1: **UAT-44 Harbour Room** is listed.
- Step 3: Harbour Room is no longer listed, because it is already booked in that slot (AC3).
- Step 4: both are refused, naming "D AM" as a date and slot; booking B stays **Requested** and shows no hold (AC2).
- Step 5: booking C is unaffected, still **Requested**, and its slot is free.
- Booking B was **Requested** beside booking A when A was held: a request still waiting
  blocks nothing, so it did not stop the hold (AC2).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-search-lists-harbour-room](../screenshots/2026-10-13_TC-VHOLD-002_step1-search-lists-harbour-room.png) · [step3-search-without-harbour-room](../screenshots/2026-10-13_TC-VHOLD-002_step3-search-without-harbour-room.png) · [step4-second-hold-refused](../screenshots/2026-10-13_TC-VHOLD-002_step4-second-hold-refused.png) · [step5-other-slot-unaffected](../screenshots/2026-10-13_TC-VHOLD-002_step5-other-slot-unaffected.png)

---

### TC-VHOLD-003: A clash or a block refuses the hold and leaves nothing behind (AC2)

**Preconditions:** The fixture above. Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for D + 2 Night (booking Y), beside Confirmed booking X, and click **Place hold**.
2. Open the **Rooftop Terrace** request for D + 6 AM (booking F, whose slot was blocked after the request) and click **Place hold**.
3. Check the database:
   ```sql
   select booking_id, status, hold_expires_at from booking where booking_id in (<booking Y>, <booking F>);
   select entity_id, action from audit_record where entity_type = 'booking' and entity_id in (<booking Y>, <booking F>);
   ```

**Expected Result:**
- Step 1: refused, naming the date D + 2 and "Night"; the booking stays **Requested** (AC2).
- Step 2: refused with "The venue is unavailable for <D + 6> AM" (AC2).
- Step 3: both are `Requested` with no expiry, and no audit rows (AC2).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-clash-with-confirmed](../screenshots/2026-10-13_TC-VHOLD-003_step1-clash-with-confirmed.png) · [step2-blocked-slot](../screenshots/2026-10-13_TC-VHOLD-003_step2-blocked-slot.png)

---

### TC-VHOLD-004: An expired hold does not block, and a live one does (AC2)

**Preconditions:** The fixture above, with the two holds from the setup (AM expired, PM live). Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for the PM slot three weeks from today (booking E), over the live hold, and click **Place hold**.
2. Open the **Main Hall** request for the AM slot three weeks from today (booking D), over the expired hold, and click **Place hold**.
3. Check the database:
   ```sql
   select b.booking_id, b.status from booking b join booking_slot bs using (booking_id)
    where b.venue_id = (select venue_id from venue where location = 'Main Hall') and bs.slot_date = current_date + 21
    order by bs.slot, b.booking_id;
   select entity_id, action from audit_record where action = 'release expired hold';
   ```

**Expected Result:**
- Step 1: refused, naming that date and PM; booking E stays **Requested**.
- Step 2: accepted: booking D reads "On hold until …" (AC2).
- Step 3: the expired hold on the AM slot is now `Released`, with a `release expired hold` audit row; the live PM hold is unchanged and booking D is `Tentative Hold` (AC2).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-live-hold-refuses](../screenshots/2026-10-13_TC-VHOLD-004_step1-live-hold-refuses.png) · [step2-expired-hold-does-not-block](../screenshots/2026-10-13_TC-VHOLD-004_step2-expired-hold-does-not-block.png)

---

### TC-VHOLD-005: Only Venue Staff, and only a waiting request (AC1, AC4)

**Preconditions:** After TC-VHOLD-001 (booking A is on hold) and the fixture's Confirmed booking X.

**Steps:**
1. Sign in as `coordinator@test.com` and open `/staff/venue/<booking A>` directly.
2. Sign in as `venue@test.com` and open booking A, then Confirmed booking X.

**Expected Result:**
- Step 1: the access-denied screen with a 403 (SPM-16), and none of the booking's details; nothing changes (AC4).
- Step 2: neither the held booking nor the Confirmed one offers **Place hold**, or any decision button (AC1).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-coordinator-denied](../screenshots/2026-10-13_TC-VHOLD-005_step1-coordinator-denied.png) · [step2-confirmed-booking-no-buttons](../screenshots/2026-10-13_TC-VHOLD-005_step2-confirmed-booking-no-buttons.png) · [step2-held-booking-no-buttons](../screenshots/2026-10-13_TC-VHOLD-005_step2-held-booking-no-buttons.png)
