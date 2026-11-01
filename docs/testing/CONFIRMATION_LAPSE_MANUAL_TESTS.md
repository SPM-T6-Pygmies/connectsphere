# Confirmation Lapse Manual Tests (SPM-111)

## Overview

Browser checks for **SPM-111: Notify the organiser that a confirmed event is
no longer confirmed**. When something takes a Confirmed event below the
confirmation criteria, it goes back to **Planning** (2026-10-18 decision;
`Blocked` stays unused; registrations are kept). Its Organiser then gets one
in-app notification:

| Subject | Badge | Body |
| --- | --- | --- |
| `<event> is no longer confirmed` | **Event no longer confirmed** | `<event> is back in Planning: <what lapsed>. Your coordinator will confirm it again once this is sorted out; until then, do not rely on these arrangements.` |

Every cause calls one database function, `lapse_event_confirmation`, inside
its own transaction. These causes have landed and are wired:

| Cause | How it lapses an event |
| --- | --- |
| Venue Staff block a venue (SPM-313) | the block flags the event's booking |
| Venue Staff edit a venue (SPM-105) | the edit flags a booking that no longer fits |
| The coordinator decides a change request (SPM-100) | an accepted change leaves the event short |

**Not reachable in the browser yet:** a lapse from a change request decision.
Today a decision can't break an arrangement on its own; SPM-309 (booking flags
on an accepted change) adds that. The decision path is unit-tested,
including AC4: an accepted time change is a reschedule, so SPM-68's notice
says the event is back in Planning and this one stays silent.

**Unit tests** (tagged `SPM-111`) cover the rule, the wording for one and two
lapsed arrangements, the in-app-only workflow, the link, the badge, the
`notification` row, and each cause:
`lapseConfirmation`, `eventNoLongerConfirmedMessage`,
`eventNoLongerConfirmedInApp`, `eventNoLongerConfirmed`,
`eventNoLongerConfirmedRow`, `notificationItem (SPM-111)`,
`DecideChangeRequestUseCase tells the Organiser of a lapse`,
`RecordVenueUnavailabilityUseCase tells the Organiser of a lapsed event`,
`UpdateVenueUseCase tells the Organiser of a lapsed event`,
`SupabaseConfirmationLapses` and `SupabaseVenueChangeReview lapses`.

These cases are registered as `TC-LAPSE-001`–`TC-LAPSE-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you
ran in the PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not
edit that file.

---

## Test Environment Setup

### Prerequisites

1. Rebuild the database, then load the venues, the sample requests and SPM-68's
   event fixture. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md \
     | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   ```
2. Load the fixture below. Confirming an event in the browser needs a venue
   booking, equipment and a safety check, so this sets that state directly:
   Operations Roadmap Conference gets a **Confirmed** booking of **Studio** on
   25 Nov 2026, 09:00–17:00, and an **Approved** safety check, and is marked
   **Confirmed**.
   ```bash
   awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/CONFIRMATION_LAPSE_MANUAL_TESTS.md \
     | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   ```
3. Clear Novu and start the app with it: `pnpm novu:clear`, then
   `pnpm dev:local`. Studio should list `event-no-longer-confirmed`.

```sql
-- SPM-111 fixture: Operations Roadmap Conference, Confirmed, with a Confirmed
-- booking of Studio on 25 Nov 2026 09:00-17:00 and an Approved safety check.
do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Operations Roadmap Conference');
  v_venue bigint := (select venue_id from public.venue where location = 'Studio');
  v_by bigint := (select ua.user_account_id from public.user_account ua
                  join auth.users u on u.id = ua.auth_user_id where u.email = 'coordinator@test.com');
  v_staff bigint := (select ua.user_account_id from public.user_account ua
                     join auth.users u on u.id = ua.auth_user_id where u.email = 'venue@test.com');
  v_safety bigint := (select ua.user_account_id from public.user_account ua
                      join auth.users u on u.id = ua.auth_user_id where u.email = 'safety@test.com');
  v_booking bigint;
begin
  insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_venue, v_event, v_by, v_staff, 'Confirmed')
  returning booking_id into v_booking;

  insert into public.booking_slot (booking_id, slot_date, slot, venue_id, status)
  select v_booking, date '2026-11-25', s.slot_code, v_venue, 'Confirmed'
  from public.slot s
  where s.start_time >= time '09:00' and s.end_time <= time '17:00' and s.end_time > s.start_time;

  insert into public.safety_check (event_id, outcome, checked_by_user_account_id)
  values (v_event, 'Approved', v_safety);

  update public.event set status = 'Confirmed' where event_id = v_event;
end $$;

select name, status from public.event where name = 'Operations Roadmap Conference';
```

The last query should print **Confirmed**. The ids below are the ones a fresh
reset gives (event `1`, request `6`); use yours if they differ.

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser2@test.com` | Event Organiser, owns Operations Roadmap Conference |
| `coordinator@test.com` | Event Coordinator assigned to it |
| `venue@test.com` | Venue Staff |

Run the cases in order.

---

## Test Cases

### TC-LAPSE-001: A block over a Confirmed event's booking takes it out of Confirmed and tells its Organiser (AC1–AC3)

**Preconditions:** Setup done. Operations Roadmap Conference is Confirmed.

**Steps:**
1. Sign in as `venue@test.com` and open **Unavailability**. Choose **Studio**,
   from and to `2026-11-25`, start **13:00**, end **15:00**, reason
   **Maintenance**. Click **Mark unavailable**.
2. Sign in as `coordinator@test.com` and open `/staff/coordinator/events/1`.
3. Sign in as `organiser2@test.com` and open **Notifications**.

**Expected Result:**
- Step 1: *Saved. Studio is blocked 2026-11-25, 13:00–15:00, for maintenance.*
- Step 2: the event shows **Planning**, with the Studio booking flagged.
- Step 3: one new unread notification, badged **Event no longer confirmed**,
  reading *Operations Roadmap Conference is no longer confirmed* /
  *Operations Roadmap Conference is back in Planning: its booking of Studio is
  being re-checked. Your coordinator will confirm it again once this is sorted
  out; until then, do not rely on these arrangements.* No internal reason (the
  block's *Maintenance*) is shown to the Organiser.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step1-block-studio](../screenshots/2026-10-30_TC-LAPSE-001_step1-block-studio.png) · [step2-block-saved](../screenshots/2026-10-30_TC-LAPSE-001_step2-block-saved.png) · [step2-coordinator-event-planning](../screenshots/2026-10-30_TC-LAPSE-001_step2-coordinator-event-planning.png) · [step3-organiser-inbox](../screenshots/2026-10-30_TC-LAPSE-001_step3-organiser-inbox.png)

### TC-LAPSE-002: The notice opens the request, showing the event in Planning, and can be marked read (AC2)

**Preconditions:** State left by TC-LAPSE-001. Signed in as
`organiser2@test.com`.

**Steps:**
1. Open **Notifications** and note the unread count.
2. Click the *Event no longer confirmed* notification.
3. Go back to **Notifications**.

**Expected Result:**
- Step 2: the request opens; **Your event** reads **Planning**, venue
  **Studio**.
- Step 3: the notification is read, and the unread count is one lower.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step2-request-shows-planning](../screenshots/2026-10-30_TC-LAPSE-002_step2-request-shows-planning.png)

### TC-LAPSE-003: A second flag on an event already back in Planning sends no second notice

**Preconditions:** State left by TC-LAPSE-002.

**Steps:**
1. As `venue@test.com`, block **Studio** on `2026-11-25` from **15:00** to
   **16:00** for **Safety**.
2. As `organiser2@test.com`, open **Notifications**.

**Expected Result:**
- Step 1: the block is saved, and the coordinator is told of the flag as usual.
- Step 2: still exactly one *Event no longer confirmed* notification: the event
  was already in Planning, so nothing lapsed.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step2-one-lapse-notice](../screenshots/2026-10-30_TC-LAPSE-003_step2-one-lapse-notice.png)
