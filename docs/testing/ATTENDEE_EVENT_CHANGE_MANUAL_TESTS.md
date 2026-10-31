# Attendee Event Change Manual Tests (SPM-69)

## Overview

Browser and inbox checks for **SPM-69: Notify attendees of a reschedule or
cancellation**. Every Attendee holding a **Registered** registration gets an
email (email only, no Inbox: an Attendee has no account) when:

| Change | Subject | Carries |
| --- | --- | --- |
| The coordinator accepts new **Date and times** on a change request (a reschedule; SPM-54 is cancelled) **and the event is Confirmed with them**: at once if it never left Confirmed, otherwise when the coordinator confirms it again | `Rescheduled: <event>` | the new date, times (GMT+8) and venue, and the registration link |
| The coordinator cancels the event (SPM-55) | `Cancelled: <event>` | that it will not take place, and the registration link |

A withdrawn registration gets nothing. Neither email carries an internal
reason, a coordinator note or any other attendee (#91), and the notice types
have no field for them. Registrations survive a reschedule (#115).

**Not covered here:** *postponed, no new date yet*. Nothing can postpone an
event: a change request's times need at least one date (as in SPM-68).

**Unit tests** (tagged `SPM-69`) cover who is emailed (Registered only, this
event only), that one failed send does not stop the rest, the wording and
HTML escaping, email-only workflows, and that an attendance-only or declined
decision emails no one: `AttendeeChangeAnnouncer`,
`DecideChangeRequestUseCase tells the attendees of a reschedule once the event is Confirmed`,
`ConfirmEventUseCase tells the attendees of a reschedule once it is confirmed`,
`CancelEventUseCase emails the attendees`,
`eventRescheduledForAttendeeEmail`, `eventCancelledForAttendeeEmail`,
`attendee event change workflows` and
`SupabaseRegistrationRepository registeredFor`.

These cases are registered as `TC-ATTCHANGE-001`–`TC-ATTCHANGE-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you
ran in the PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not
edit that file.

**These send real email.** Novu delivers through Resend (SPM-308), so use
addresses whose inboxes you can read. The steps use `<you+a@…>` and
`<you+b@…>`; substitute your own.

---

## Test Environment Setup

### Prerequisites

1. Rebuild the database and load the venues, the sample requests and SPM-68's
   event fixture. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md \
     | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   ```
2. Load the fixture below. It makes Operations Roadmap Conference **Confirmed**
   and open for registration: 25 Nov 2026 09:00–17:00 at **Studio**, with an
   Approved safety check. Accepting new times flags its booking and sends it back
   to Planning, so attendees are told when you confirm it again (TC-ATTCHANGE-001).
   ```bash
   awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/ATTENDEE_EVENT_CHANGE_MANUAL_TESTS.md \
     | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   ```
3. Start the app with Novu: `pnpm dev:local`. Studio should list
   `attendee-event-rescheduled` and `attendee-event-cancelled`.

```sql
-- SPM-69 fixture: Operations Roadmap Conference, Confirmed and open for
-- registration, on 25 Nov 2026 09:00-17:00 at Studio, safety check Approved.
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
  insert into public.event_slot (event_id, slot_date, slot_code)
  select v_event, date '2026-11-25', s.slot_code
  from public.slot s
  where s.start_time >= time '09:00' and s.end_time <= time '17:00' and s.end_time > s.start_time;

  insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_venue, v_event, v_by, v_staff, 'Confirmed')
  returning booking_id into v_booking;

  insert into public.booking_slot (booking_id, slot_date, slot, venue_id, status)
  select v_booking, date '2026-11-25', s.slot_code, v_venue, 'Confirmed'
  from public.slot s
  where s.start_time >= time '09:00' and s.end_time <= time '17:00' and s.end_time > s.start_time;

  insert into public.safety_check (event_id, outcome, checked_by_user_account_id)
  values (v_event, 'Approved', v_safety);

  update public.event
  set status = 'Confirmed',
      registration_enabled_flag = true,
      registration_open_date = current_date - 1,
      registration_close_date = current_date + 7
  where event_id = v_event;
end $$;

select event_id, name, status from public.event where name = 'Operations Roadmap Conference';
```

The last query should print event `1`, **Confirmed**; use your id if it
differs. Its request is `6`.

### Test Accounts

Password for all: `TestPass123!`. Attendees register with no login.

| Account | Role |
| --- | --- |
| `organiser2@test.com` | Event Organiser, owns Operations Roadmap Conference |
| `coordinator@test.com` | Event Coordinator assigned to it |

Run the cases in order.

---

## Test Cases

### TC-ATTCHANGE-001: Confirming a rescheduled event emails every Registered attendee the new date, time and venue (AC1, AC2, AC3)

**Preconditions:** Setup done. Signed out, in a private window.

**Steps:**
1. Open `/events/1`. Register as **Mei Lin**, `<you+a@…>`. Register again as
   **Raj Kumar**, `<you+b@…>`.
2. Open `<you+b@…>`'s confirmation email, follow its link, and **Withdraw**.
3. Sign in as `organiser2@test.com`. **Request a change** on Operations
   Roadmap Conference: tick **Date and times** and enter 3 Dec 2026,
   10:00–15:00. Submit.
4. Sign in as `coordinator@test.com`, open
   `/staff/coordinator/events/1/change-request`, **Accept** Date and times
   and **Save decision**.
5. Open both inboxes: nothing yet. The event is back in Planning, so its
   public page no longer lists it.
6. As the coordinator, clear the flag on the Studio booking, then **Confirm**
   the event.
7. Open both inboxes.

**Expected Result:**
- Step 5: neither inbox has a reschedule email.
- Step 7: `<you+a@…>` gets *Rescheduled: Operations Roadmap Conference*:
  *Hi Mei Lin*, *…has been rescheduled. Your registration still stands.*,
  *Date: Thursday, 3 December 2026*, *Time: 10:00 am – 3:00 pm (GMT+8)*,
  *Venue: Studio*, and a `/registrations/<reference>` link that opens Mei's
  registration. Nothing about why, and no other attendee.
- `<you+b@…>` (withdrawn) gets no reschedule email.

**Status:** [ ] Pass [ ] Fail — to re-run: the email now goes out on confirmation (previously run 30/10/2026 with the email sent on acceptance)

### TC-ATTCHANGE-002: Cancelling emails every Registered attendee (AC1, AC3)

**Preconditions:** State left by TC-ATTCHANGE-001. Signed in as
`coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/1`, click **Cancel event**, then **Yes,
   cancel event**.
2. Open both inboxes.

**Expected Result:**
- Step 2: `<you+a@…>` gets *Cancelled: Operations Roadmap Conference*: *Hi
  Mei Lin*, *We're sorry: … has been cancelled and will not take place.*, and
  the registration link. No reason, nothing internal.
- `<you+b@…>` (withdrawn) gets nothing.

**Status:** [x] Pass [ ] Fail — 30/10/2026, run in the browser with real Gmail inboxes

### TC-ATTCHANGE-003: A change that is not a reschedule emails no attendee (AC1)

**Preconditions:** Setup done (a fresh run), with `<you+a@…>` registered as
in TC-ATTCHANGE-001 step 1.

**Steps:**
1. As `organiser2@test.com`, **Request a change**: tick **Expected attendance**
   and enter `250`. Submit.
2. As `coordinator@test.com`, **Accept** it and **Save decision**.
3. Open `<you+a@…>`'s inbox.

**Expected Result:**
- Step 3: no new email after the registration confirmation.

**Status:** [x] Pass [ ] Fail — 30/10/2026, run in the browser with real Gmail inboxes

### TC-ATTCHANGE-004: A registration link for an event not yet re-confirmed says its details are unavailable (AC5)

**Preconditions:** Setup done (a fresh run), with `<you+a@…>` registered as in
TC-ATTCHANGE-001 step 1. Keep the confirmation email open.

**Steps:**
1. As `organiser2@test.com`, **Request a change**: tick **Date and times** and
   enter 3 Dec 2026, 10:00–15:00. Submit.
2. As `coordinator@test.com`, **Accept** it and **Save decision**. The event is
   back in Planning.
3. Signed out, open the link in `<you+a@…>`'s confirmation email.
4. Open `/registrations/00000000-0000-4000-8000-000000000000`.

**Expected Result:**
- Step 3: *This event's details aren't available right now* and *Your
  registration is kept. The event may have changed or been cancelled…*. Not *We
  couldn't find that registration*.
- Step 4: *We couldn't find that registration*.

**Status:** [ ] Pass [ ] Fail — not run
