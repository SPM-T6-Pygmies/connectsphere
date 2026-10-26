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

### Prerequisites

- Local Supabase, reset:
  ```bash
  supabase start
  supabase db reset
  ```
- `pnpm dev` is enough: nothing here needs Novu. With `pnpm dev:local`, Venue Staff also get
  the ordinary new-request notice (SPM-61) for each re-request, and the coordinator the
  ordinary decision notice (SPM-62).
- Two browser profiles or private windows: the cases switch between `coordinator@test.com`,
  `coordinator2@test.com` and `venue@test.com`. Every password is `TestPass123!`.

### Fixture

**D** is 35 days from today in Singapore time, a day no other seed uses. The fixture adds:

- three venues, all open 07:00–24:00:
  - **RR Grand Hall:** Theatre 200, Banquet 120; 30 minutes setup, 30 minutes turnaround;
  - **RR Studio:** Theatre 60;
  - **RR Terrace:** Banquet 150;
- two events:

| Event | Coordinator | Event times | Bookings |
| --- | --- | --- | --- |
| Re-request Test: Tech Summit | Test Coordinator | D 14:00–17:00, 110 expected, prefers Banquet | **A** RR Grand Hall D 13:00–18:00, Theatre, Confirmed; **B** RR Studio D 13:00–18:00, Confirmed |
| Re-request Test: Evening Gala | Test Coordinator 2 | D 19:00–24:00 | RR Grand Hall D 19:00–24:00, Confirmed |

It then records two blocks as Test Venue Staff, through the same function the Unavailability
form calls:

- Maintenance on RR Grand Hall, D 13:00–14:00, flags **A**;
- Renovation on RR Studio, D 13:00–18:00, flags **B**.

A was booked 13:00–18:00, but the event has since moved to 14:00–17:00 and now prefers Banquet.
That is why the form starts from the event, not from A.

Load it after the reset. Running it again puts everything back as above, so the cases can be
re-run without a reset. To load it without `psql` installed:

```bash
awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/VENUE_RE_REQUEST_MANUAL_TESTS.md \
  | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
```

```sql
do $$
declare
  d           date   := (now() at time zone 'Asia/Singapore')::date + 35;
  v_org       bigint := (select client_organisation_id from public.client_organisation where name = 'Test Organisation');
  v_organiser bigint := (select user_account_id from public.user_account where name = 'Test Organiser');
  v_staff     bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_coord     bigint := (select user_account_id from public.user_account where name = 'Test Coordinator' and client_organisation_id is null);
  v_coord2    bigint := (select user_account_id from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null);
  v_hall      bigint;
  v_studio    bigint;
  v_terrace   bigint;
  v_event     bigint;
  v_booking   bigint;
  r           record;
begin
  if v_org is null or v_staff is null or v_coord is null or v_coord2 is null then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;

  -- Earlier runs go: the events take their bookings, re-requests and flags with them, then the blocks.
  delete from public.event where name like 'Re-request Test: %' and client_organisation_id = v_org;
  delete from public.venue_unavailability
  where venue_id in (select venue_id from public.venue where location like 'RR %');

  for r in
    select * from (values
      ('RR Grand Hall', 200, 30, 30),
      ('RR Studio',      60,  0,  0),
      ('RR Terrace',    150,  0,  0)
    ) as v (location, capacity, setup, turnaround)
  loop
    if not exists (select 1 from public.venue where location = r.location) then
      insert into public.venue (location, capacity, setup_time_minutes, turnaround_time_minutes)
      values (r.location, r.capacity, r.setup, r.turnaround);
    end if;
    -- Open 07:00-24:00 on the 15-minute grid.
    insert into public.venue_slot (venue_id, slot_code)
    select v.venue_id, n::text
    from public.venue v cross join generate_series(28, 95) n
    where v.location = r.location
      and not exists (select 1 from public.venue_slot s where s.venue_id = v.venue_id);
  end loop;
  select venue_id into v_hall from public.venue where location = 'RR Grand Hall';
  select venue_id into v_studio from public.venue where location = 'RR Studio';
  select venue_id into v_terrace from public.venue where location = 'RR Terrace';

  insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
  select v.venue_id, rl.room_layout_id, l.capacity
  from (values (v_hall, 'Theatre', 200), (v_hall, 'Banquet', 120),
               (v_studio, 'Theatre', 60), (v_terrace, 'Banquet', 150)) as l (venue_id, layout, capacity)
  join public.venue v on v.venue_id = l.venue_id
  join public.room_layout rl on rl.name = l.layout
  on conflict (venue_id, room_layout_id) do nothing;

  for r in
    select * from (values
      ('Re-request Test: Tech Summit',  v_coord,  110, 'Banquet', 56, 67),
      ('Re-request Test: Evening Gala', v_coord2,  80, null,      76, 95)
    ) as e (name, coordinator, attendance, layout, first_code, last_code)
  loop
    insert into public.event (
      name, preferred_date, status, assigned_coordinator_user_account_id,
      owning_organiser_user_account_id, client_organisation_id, expected_attendance, room_layout_preference
    )
    values (r.name, d, 'Planning', r.coordinator, v_organiser, v_org, r.attendance, r.layout)
    returning event_id into v_event;
    insert into public.event_slot (event_id, slot_date, slot_code)
    select v_event, d, n::text from generate_series(r.first_code, r.last_code) n;
  end loop;

  for r in
    select * from (values
      ('Re-request Test: Tech Summit',  v_hall,   'Theatre', 52, 71),
      ('Re-request Test: Tech Summit',  v_studio, 'Theatre', 52, 71),
      ('Re-request Test: Evening Gala', v_hall,   'Theatre', 76, 95)
    ) as b (event_name, venue_id, layout, first_code, last_code)
  loop
    insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
    select b.venue_id, e.event_id, e.assigned_coordinator_user_account_id, v_staff, 'Confirmed',
           (select room_layout_id from public.room_layout where name = b.layout)
    from (select r.event_name as name, r.venue_id, r.layout) b
    join public.event e on e.name = b.name and e.client_organisation_id = v_org
    returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, d, n::text from generate_series(r.first_code, r.last_code) n;
  end loop;

  -- The blocks that flag A (its first hour) and B (all of it).
  perform public.venue_staff_record_unavailability(v_staff, v_hall, 'Maintenance', null,
    (select jsonb_agg(jsonb_build_object('date', d, 'slot', n::text) order by n) from generate_series(52, 55) n));
  perform public.venue_staff_record_unavailability(v_staff, v_studio, 'Renovation', null,
    (select jsonb_agg(jsonb_build_object('date', d, 'slot', n::text) order by n) from generate_series(52, 71) n));
end $$;
```

To see where the bookings stand at any point, run this. It is read-only:

```bash
cat <<'SQL' | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
select b.booking_id, e.name as event, v.location, b.status, b.replaces_booking_id, b.replaced_by_booking_id,
       (select string_agg(coalesce(f.cleared_how, 'open'), ', ') from public.booking_review_flag f
         where f.booking_id = b.booking_id) as flags
from public.booking b
join public.event e using (event_id)
join public.venue v using (venue_id)
where e.name like 'Re-request Test: %'
order by b.booking_id;
SQL
```

---

## Test Cases

Run them in order: each starts where the one before left off.

### TC-VREQ-001: The Flagged card starts a re-request, pre-filled from the event (AC1, AC2)

**Preconditions:** Fixture loaded. Signed in as `coordinator@test.com`.

**Steps and expected results:**

1. Open **My events → Re-request Test: Tech Summit → Venue**.
   - **Flagged for review** lists A (RR Grand Hall, Maintenance: D 13:00 to 14:00) and B
     (RR Studio, Renovation: D 13:00 to 18:00).
   - Under **Booking requests for this event**, A and B are Confirmed with an amber
     **Flagged** badge.
   - The Evening Gala's booking is not listed.
2. Hover or click A's **Flagged** badge.
   - The card shows the reason, **Re-request venue** and **Clear flag**.
3. Click **Re-request venue**.
   - The URL ends `?tab=venue&replace=<A's id>#new-request`.
   - The form card is titled **Re-request a venue** and reads "Replacing RR Grand Hall, booked
     for D 13:00 to 18:00."
   - **Venue** is RR Grand Hall and **Room layout** is Banquet: the event's preference, not A's
     Theatre.
   - The checklist reads Suitable (Banquet seats 120, fits the 110 expected).
   - **Dates and times** has one row, D 14:00 to 17:00.
   - The button reads **Send re-request**.
4. Click **Search venues with these details**.
   - Find a venue opens with date D, 14:00 to 17:00, attendance 110 and layout Banquet filled
     in, and lists venues for them.
5. Go back, then click **Cancel re-request**.
   - The card is the ordinary **New booking request** again.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-001_step3-coordinator-pre-filled.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-002: A re-request for another venue, as Venue Staff see it (AC3, AC4, AC10)

**Preconditions:** TC-VREQ-001 done. Signed in as `coordinator@test.com`.

**Steps and expected results:**

1. Open A's card again, click **Re-request venue**, choose **RR Terrace** and click **Send
   re-request**.
   - A toast reads "Re-request sent for RR Terrace. Venue Staff will review it. The booking at
     RR Grand Hall stays until they approve it."
   - The form card is back to **New booking request**.
   - The list has a new RR Terrace row: Requested, "Re-request for RR Grand Hall". A is still
     Confirmed and Flagged.
2. In the other window, sign in as `venue@test.com` and open **Requests**.
   - The RR Terrace request is listed like any other.
3. Open it.
   - An alert reads "Replaces: RR Grand Hall, D 13:00–18:00 (Confirmed)".
   - The decision form has **Approve booking** and **Reject**, and no **Place hold**.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-002_step3-venue-staff-replaces.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-003: One re-request at a time, even from two tabs (AC9)

**Preconditions:** TC-VREQ-002 done (the RR Terrace re-request is waiting). Signed in as
`coordinator@test.com`.

**Steps and expected results:**

1. Open A's **Flagged** card.
   - It reads "Re-request pending with Venue Staff." instead of the button. **Clear flag** is
     still there.
2. Open B's **Flagged** card.
   - It still offers **Re-request venue**: the waiting re-request is A's alone (AC8).
3. Open B's re-request in two tabs (B's card → **Re-request venue** in each). Choose RR Terrace
   in tab 1 and RR Grand Hall in tab 2. Click **Send re-request** in tab 1, then in tab 2.
   - Tab 1 is sent.
   - Tab 2 shows "A re-request for this booking is already waiting for Venue Staff." and saves
     nothing.
   - After a refresh, B has one re-request.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-003_step3-second-tab-refused.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-004: A rejected re-request leaves the booking flagged (AC7)

**Preconditions:** TC-VREQ-003 done. Two windows: `venue@test.com` and `coordinator@test.com`.

**Steps and expected results:**

1. As Venue Staff, open the RR Terrace re-request for A. Enter "Terrace is closed for a private
   event" and click **Reject**.
   - It is Rejected.
2. As the coordinator, reload the Venue tab.
   - The RR Terrace row is Rejected and shows the reason.
   - A is still Confirmed and Flagged, and still listed under **Flagged for review**.
   - A's card offers **Re-request venue** again.
   - The event is still Planning.

**Evidence:** `docs/screenshots/<date>_TC-VREQ-004_step2-still-flagged.png`

**Status:** [ ] Pass [ ] Fail

### TC-VREQ-005: Approving a same-venue re-request replaces the booking (AC3, AC5, AC6, AC8)

**Preconditions:** TC-VREQ-004 done. Two windows: `coordinator@test.com` and `venue@test.com`.

**Steps and expected results:**

1. As the coordinator, click A's **Re-request venue** and send it as pre-filled: RR Grand Hall,
   Banquet, D 14:00 to 17:00.
   - It is sent. It overlaps A, but A is the booking it replaces, so there is no clash.
2. As Venue Staff, open it and click **Approve booking**.
   - It is Confirmed. Its padded time, 13:30 to 17:30, overlaps A, but A is the booking it
     replaces; it does not reach the Gala's padded 18:30.
3. As the coordinator, reload the Venue tab.
   - A is Released, with "Replaced by RR Grand Hall" and no badge.
   - The new RR Grand Hall row is Confirmed, "Re-request for RR Grand Hall".
   - **Flagged for review** lists only B, which is still flagged and offers re-request (AC8).
4. Run the bookings query from Setup.
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
