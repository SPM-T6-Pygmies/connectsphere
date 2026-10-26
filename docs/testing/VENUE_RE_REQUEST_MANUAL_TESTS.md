# Venue Re-request Manual Tests (SPM-251)

## Overview

Checks for **SPM-251: Re-request a flagged venue booking**. When a booking is flagged
(SPM-313 block, SPM-105 venue edit, SPM-309 accepted change), the event's assigned coordinator
can ask for a venue again from the booking's amber **Flagged** card on the event's Venue tab.

- **Re-request venue** opens the booking form as **Re-request a venue**. The form is pre-filled
  from the event as it is now: the booking's venue, the event's current times and its layout
  preference.
- The coordinator may keep the venue or pick another. The re-request is an ordinary booking
  request: the same checks and the same Venue Staff queue.
- Venue Staff see which booking it replaces. They can approve or reject it, but not hold it.
- **Approving** releases the original, links it as replaced by the new booking, and closes its
  flags as `replaced`.
- **Rejecting** leaves the original as it was, still flagged, so it can be re-requested again.
- Only one re-request per booking can wait at a time.

Not covered here:

- clearing a flag instead (SPM-310, [`VENUE_FLAG_CLEAR_MANUAL_TESTS.md`](VENUE_FLAG_CLEAR_MANUAL_TESTS.md));
- telling the coordinator the outcome: SPM-62's ordinary approve/reject notice,
  [`VENUE_BOOKING_DECISION_NOTIFICATION_MANUAL_TESTS.md`](VENUE_BOOKING_DECISION_NOTIFICATION_MANUAL_TESTS.md);
- blocking confirmation while flagged (SPM-312);
- flag notices (SPM-71).

The rules are unit-tested:

- `bookingToReplace`, `requestVenueBooking replacing a flagged booking`, `decideBooking on a
  re-request` and `reRequestDraft` (all SPM-251);
- the use cases: `SubmitVenueBookingRequestUseCase re-requesting a flagged booking`,
  `DecideBookingRequestUseCase on a re-request` and `ViewVenueBookingOptionsUseCase
  re-requesting a flagged booking`;
- the Supabase adapters: `Supabase adapters for re-requesting a flagged booking`.

The database side is checked by `scripts/seed-booking-flags/re-request-checks.sql` (27 checks).
These cases check the page end to end. They are registered as `TC-VREQ-001`–`TC-VREQ-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

---

## Test Environment Setup

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- `pnpm dev` is enough: nothing here needs Novu. With `pnpm dev:local`, Venue Staff also get
  the ordinary new-request notice (SPM-61) for each re-request, and the coordinator the
  ordinary decision notice (SPM-62).
- Two browser profiles or private windows: the cases switch between `coordinator@test.com`,
  `coordinator2@test.com` and `venue@test.com`. Every password is `TestPass123!`.

### Steps

1. Rebuild the database. This **drops all your local data**:
   ```bash
   supabase start
   supabase db reset
   ```
2. Load the baseline these cases need, then this ticket's seed, in this order:
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-re-request/seed.sql --local
   ```
3. Check what loaded:
   ```bash
   supabase db query --file scripts/seed-venue-re-request/show.sql --local
   ```
   It lists 3 bookings: A and B Confirmed with an `open` flag each, and the Evening Gala's with
   none.
4. Start the app: `pnpm dev`, then open <http://localhost:3000/auth/login>.

**D** is 49 days from today in Singapore time, a day no other seed uses. `seed-venues` gives:

- **Main Hall:** Theatre 300, Banquet 180, Classroom 150; 30 minutes setup, 45 turnaround;
- **Studio:** Theatre 60;
- **Rooftop Terrace:** Banquet 120, Exhibition 150.

All three are open 07:00–24:00. `seed-venue-re-request` adds:

| Event | Coordinator | Event times | Bookings |
| --- | --- | --- | --- |
| Re-request Test: Tech Summit | Test Coordinator | D 14:00–17:00, 110 expected, prefers Banquet | **A** Main Hall D 13:00–18:00, Theatre, Confirmed; **B** Studio D 13:00–18:00, Confirmed |
| Re-request Test: Evening Gala | Test Coordinator 2 | D 19:00–24:00 | Main Hall D 19:00–24:00, Confirmed |

It then records two blocks as Test Venue Staff, through the same function the Unavailability
form calls:

- Maintenance on Main Hall, D 13:00–14:00, flags **A**;
- Renovation on Studio, D 13:00–18:00, flags **B**.

A was booked 13:00–18:00, but the event has since moved to 14:00–17:00 and now prefers Banquet.
That is why the form starts from the event, not from A.

To run the cases again without a reset, re-run step 2's last command: the seed replaces its own
events, bookings, re-requests and blocks. To remove them:

```bash
supabase db query --file scripts/seed-venue-re-request/teardown.sql --local
```

---

## Test Cases

Run them in order: each starts where the one before left off.

### TC-VREQ-001: The Flagged card starts a re-request, pre-filled from the event (AC1, AC2)

**Preconditions:** Fixture loaded. Signed in as `coordinator@test.com`.

**Steps and expected results:**

1. Open **My events → Re-request Test: Tech Summit → Venue**.
   - **Flagged for review** lists A (Main Hall, Maintenance: D 13:00 to 14:00) and B
     (Studio, Renovation: D 13:00 to 18:00).
   - Under **Booking requests for this event**, A and B are Confirmed with an amber
     **Flagged** badge.
   - The Evening Gala's booking is not listed.
2. Hover or click A's **Flagged** badge.
   - The card shows the reason, **Re-request venue** and **Clear flag**.
3. Click **Re-request venue**.
   - The URL ends `?tab=venue&replace=<A's id>#new-request`.
   - The form card is titled **Re-request a venue** and reads "Replacing Main Hall, booked
     for D 13:00 to 18:00."
   - **Venue** is Main Hall and **Room layout** is Banquet: the event's preference, not A's
     Theatre.
   - The checklist reads Suitable (Banquet seats 180, fits the 110 expected).
   - **Dates and times** has one row, D 14:00 to 17:00.
   - The button reads **Send re-request**.
4. Click **Search venues with these details**.
   - Find a venue opens with date D, 14:00 to 17:00, attendance 110 and layout Banquet filled
     in. Its results follow Find a venue's own rules (SPM-44): `seed-venues` records no booking
     horizon, so it reports those venues as not shown for "no opening hours or booking horizon
     recorded".
5. Go back, then click **Cancel re-request**.
   - The card is the ordinary **New booking request** again.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-001_step3-coordinator-pre-filled.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-002: A re-request for another venue, as Venue Staff see it (AC3, AC4, AC10)

**Preconditions:** TC-VREQ-001 done. Signed in as `coordinator@test.com`.

**Steps and expected results:**

1. Open A's card again, click **Re-request venue**, choose **Rooftop Terrace** with **Banquet** and click
   **Send re-request**.
   - A toast reads "Re-request sent for Rooftop Terrace. Venue Staff will review it. The booking at
     Main Hall stays until they approve it."
   - The form card is back to **New booking request**.
   - The list has a new Rooftop Terrace row: Requested, "Re-request for Main Hall". A is still
     Confirmed and Flagged.
2. In the other window, sign in as `venue@test.com` and open **Requests**.
   - The Rooftop Terrace request is listed like any other.
3. Open it.
   - An alert reads "Replaces: Main Hall, D 13:00–18:00 (Confirmed)".
   - The decision form has **Approve booking** and **Reject**, and no **Place hold**.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-002_step3-venue-staff-replaces.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-003: One re-request at a time, even from two tabs (AC9)

**Preconditions:** TC-VREQ-002 done (the Rooftop Terrace re-request is waiting). Signed in as
`coordinator@test.com`.

**Steps and expected results:**

1. Open A's **Flagged** card.
   - It reads "Re-request pending with Venue Staff." instead of the button. **Clear flag** is
     still there.
2. Open B's **Flagged** card.
   - It still offers **Re-request venue**: the waiting re-request is A's alone (AC8).
3. Open B's re-request in two tabs (B's card → **Re-request venue** in each). Choose Rooftop Terrace
   with Banquet in tab 1 and Main Hall in tab 2. Click **Send re-request** in tab 1, then in tab 2.
   - Tab 1 is sent.
   - Tab 2 shows "A re-request for this booking is already waiting for Venue Staff." and saves
     nothing.
   - After a refresh, B has one re-request.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-003_step3-second-tab-refused.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-004: A rejected re-request leaves the booking flagged (AC7)

**Preconditions:** TC-VREQ-003 done. Two windows: `venue@test.com` and `coordinator@test.com`.

**Steps and expected results:**

1. As Venue Staff, open the Rooftop Terrace re-request for A. Enter "Terrace is closed for a private
   event" and click **Reject**.
   - It is Rejected.
2. As the coordinator, reload the Venue tab.
   - The Rooftop Terrace row is Rejected and shows the reason.
   - A is still Confirmed and Flagged, and still listed under **Flagged for review**.
   - A's card offers **Re-request venue** again.
   - The event is still Planning.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-004_step2-still-flagged.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-005: Approving a same-venue re-request replaces the booking (AC3, AC5, AC6, AC8)

**Preconditions:** TC-VREQ-004 done. Two windows: `coordinator@test.com` and `venue@test.com`.

**Steps and expected results:**

1. As the coordinator, click A's **Re-request venue** and send it as pre-filled: Main Hall,
   Banquet, D 14:00 to 17:00.
   - It is sent. It overlaps A, but A is the booking it replaces, so there is no clash.
2. As Venue Staff, open it and click **Approve booking**.
   - It is Confirmed. Its padded time, 13:30 to 17:45, overlaps A, but A is the booking it
     replaces; it does not reach the Gala's padded 18:30.
3. As the coordinator, reload the Venue tab.
   - A is Released, with "Replaced by Main Hall" and no badge.
   - The new Main Hall row is Confirmed, "Re-request for Main Hall".
   - **Flagged for review** lists only B, which is still flagged and offers re-request (AC8).
4. Run `scripts/seed-venue-re-request/show.sql`.
   - A is Released, `replaced_by_booking_id` is the new booking, and its flag reads `replaced`,
     not `booking-ended`.
   - B's flag is still `open`.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-005_step3-replaced.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-006: Nobody else can re-request (AC1)

**Preconditions:** Fixture loaded.

**Steps and expected results:**

1. Sign in as `coordinator2@test.com` and open
   `/staff/coordinator/events/<Tech Summit's id>?tab=venue&replace=<B's id>`.
   - The access-denied page (403).
2. Sign in as `venue@test.com` and open the same URL.
   - The access-denied page (403).
3. As `coordinator@test.com`, open the Venue tab with `&replace=` set to the Evening Gala's
   booking id, which is not on this event.
   - The ordinary **New booking request** form. Nothing is pre-filled from another event's
     booking.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-006_step1-coordinator-2-denied.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-007: The database restates every rule, and two sessions racing save one (AC1, AC4–AC10)

**Preconditions:** Supabase reset, then `scripts/seed-coordinator-view/seed.sql`,
`scripts/seed-venues/seed.sql` and `scripts/seed-booking-flags/seed.sql` loaded. Those are the
checks' own fixture, not this file's.

**Steps and expected results:**

1. Run the checks:
   ```bash
   supabase db query --file scripts/seed-booking-flags/re-request-checks.sql --local
   ```
   - The message reads `ok: all 27 checks held`.
   - The checks cover:
     - CS020 for another coordinator and for Venue Staff;
     - CS026 for a booking on another event;
     - CS085 for an unflagged booking, and for one already replaced;
     - CS025 for another booking's clash, and CS028 for the blocked hour;
     - CS086 for a second re-request, plus 23505 when written past the function;
     - CS087 for a hold;
     - on rejection, the original stays flagged;
     - on approval over its own original: it is Released and replaced-by is set; its flags read
       `replaced` and are cleared by Venue Staff; one `replace` audit row is written; the
       event's other booking is untouched;
     - a re-request whose original was cancelled is confirmed and leaves that booking alone;
     - a signed-in user's direct update is refused.
   - Nothing is left behind: the script ends in an error, which rolls back.
2. Race two sessions. Record a block that flags the Tech Summit's Studio booking:
   ```bash
   cat <<'SQL' | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   select public.venue_staff_record_unavailability(
     (select user_account_id from public.user_account where name = 'Test Venue Staff'),
     (select venue_id from public.venue where location = 'Studio'), 'Renovation', null,
     (select jsonb_agg(jsonb_build_object('date', (now() at time zone 'Asia/Singapore')::date + 28, 'slot', n::text))
        from generate_series(52, 71) n));
   SQL
   ```
   Save this as `/tmp/race.sql`, then copy it into the database container:
   ```sql
   \set ON_ERROR_STOP off
   begin;
   select 'session ' || :'who' || ' saved booking ' || public.coordinator_submit_booking_request(
     (select user_account_id from public.user_account where name = 'Test Coordinator' and client_organisation_id is null),
     (select event_id from public.event where name = 'Flag Test: Tech Summit'),
     (select venue_id from public.venue where location = :'venue'), :'layout',
     (select jsonb_agg(jsonb_build_object('date', (now() at time zone 'Asia/Singapore')::date + 30, 'slot', n::text))
        from generate_series(56, 67) n),
     (select b.booking_id from public.booking b join public.event e using (event_id) join public.venue v using (venue_id)
       where e.name = 'Flag Test: Tech Summit' and v.location = 'Studio'));
   select pg_sleep(3);
   commit;
   ```
   ```bash
   docker cp /tmp/race.sql supabase_db_connectsphere:/tmp/race.sql
   docker exec supabase_db_connectsphere psql -U postgres -d postgres -v who=A -v venue='Rooftop Terrace' -v layout=Banquet -f /tmp/race.sql &
   sleep 1
   docker exec supabase_db_connectsphere psql -U postgres -d postgres -v who=B -v venue='Main Hall' -v layout=Theatre -f /tmp/race.sql
   ```
   - Session A saves its booking.
   - Session B waits until A commits, then fails with "A re-request for booking … is already
     waiting" (CS086).
   - Exactly one booking has `replaces_booking_id` set to the Studio booking.

**Status:** [ ] Pass [ ] Fail

---

## Run record: 2026-10-26

Run by Claude Code for arinmakk on branch `claude/deliver-spm-251-u4f6rq`.

**Environment:** the cloud container could pull only the `supabase/postgres:17.11.0.006`
image; every other Supabase image was refused ("Data limit exceeded"). Fetching standalone Auth
and PostgREST binaries was not allowed in this session. So every migration and
`supabase/seed.sql` were applied to that Postgres alone, with the Supabase Auth tables stubbed,
and only the database case could run. The pages were rendered in headless Chromium against a
throwaway local page that fed the real Venue tab components from the in-memory adapters. That
confirmed the Flagged card, the pre-filled form, the pending and replaced states, and the
search link. It is not a run of the browser cases, so those stay Not Executed.

| Case | Result | Observed |
| --- | --- | --- |
| TC-VREQ-001 | Not Executed | Needs the full local stack |
| TC-VREQ-002 | Not Executed | Needs the full local stack |
| TC-VREQ-003 | Not Executed | Needs the full local stack |
| TC-VREQ-004 | Not Executed | Needs the full local stack |
| TC-VREQ-005 | Not Executed | Needs the full local stack |
| TC-VREQ-006 | Not Executed | Needs the full local stack |
| TC-VREQ-007 | Pass | `ok: all 27 checks held`. In the race, B waited for A's commit, then got CS086; one re-request saved |
