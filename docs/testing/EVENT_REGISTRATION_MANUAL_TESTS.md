# Event Registration Manual Tests (SPM-24, SPM-28)

## Overview

Browser checks for the attendee side of an event: finding an event that is open
for registration, registering for it, and withdrawing that registration later
from the link the confirmation hands over. Attendees have no account, so every
case here runs signed out, on the public `/events` and `/registrations/*` pages.

The rules themselves (open window, capacity, one live registration per email,
withdrawal allowed until the event is Completed) are unit-tested under
`SPM-24` and `SPM-28` and its sub-tasks. These cases check what an attendee
actually sees.

These cases are registered as `TC-REG-001`–`TC-REG-003` (registering, SPM-24)
and `TC-REGWD-001`–`TC-REGWD-003` (withdrawing, SPM-28) in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

All six were backfilled on 2026-10-04 from the checks reported in PR #8 and
PR #9. Each case covers only what its PR showed or said was checked.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the test accounts and the seeded venues:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-venues/seed.sql --local
  ```
- `pnpm dev:local`
- A private/incognito window, so no staff session is involved

### A Confirmed event that is open for registration

No seed script creates an attendee-facing event, so add one. Run this in
Supabase Studio's SQL editor (http://127.0.0.1:54323). It creates a Confirmed
event two weeks from today, with registration open from yesterday until a week
from today, and a Confirmed booking at **Main Hall** so the event has a venue:

```sql
do $$
declare
  v_organiser bigint;
  v_org       bigint;
  v_venue     bigint;
  v_event     bigint;
begin
  select user_account_id, client_organisation_id into v_organiser, v_org
    from public.user_account where name = 'Test Organiser';
  select venue_id into v_venue from public.venue where location = 'Main Hall';

  insert into public.event (name, description, status, start_time, end_time,
      registration_enabled_flag, registration_open_date, registration_close_date,
      owning_organiser_user_account_id, client_organisation_id)
  values ('TC-REG test event', 'Seeded for the event registration manual tests.', 'Confirmed',
      (current_date + 14 + time '09:00') at time zone 'Asia/Singapore',
      (current_date + 14 + time '17:00') at time zone 'Asia/Singapore',
      true, current_date - 1, current_date + 7, v_organiser, v_org)
  returning event_id into v_event;

  insert into public.booking (venue_id, event_id, requested_by_user_account_id,
      decided_by_user_account_id, status)
  values (v_venue, v_event, v_organiser, v_organiser, 'Confirmed');

  raise notice 'TC-REG event id = %', v_event;
end $$;
```

Call the printed id `<event-id>`. Use any name and an email address you have not
registered with for this event yet (e.g. `attendee+<n>@example.com`).

### Test Accounts

None. Attendees register by name and email with no login (see
[`supabase/SEED.md`](../../supabase/SEED.md)); `Test Organiser` is used only as
the event's owner in the SQL above.

---

## Test Cases

### TC-REG-001: An open Confirmed event is listed with its time and venue

Origin: Backfilled 2026-10-04 from PR #8 (screenshot of `/events` listing the
Confirmed test event under its date heading, with its time range and venue).

**Preconditions:** The setup event exists; signed out.

**Steps:**
1. Open `/events`.

**Expected Result:**
- Heading **Events**, with "Everything open for registration right now. Times
  are Singapore time." and a **Search events** box
- The event appears under a day heading for its date (e.g. "18 Oct / Sunday")
- Its card shows the name, the time range "9:00 am – 5:00 pm" and the venue
  **Main Hall**

**Status:** [ ] Pass [ ] Fail

---

### TC-REG-002: The event page shows its details and a name-and-email registration form

Origin: Backfilled 2026-10-04 from PR #8 (screenshot of `/events/1` showing the
event's date, time, venue and description, and a Register form asking for Full
name and Email address with the closing date).

**Preconditions:** As TC-REG-001.

**Steps:**
1. On `/events`, click the event's card (or open `/events/<event-id>`).

**Expected Result:**
- An **All events** link back to the list
- The event name as the heading, then its full date, time range "9:00 am –
  5:00 pm" and venue **Main Hall**, then its description
- A **Register** section reading "Registration closes <weekday, d Month
  yyyy>." with exactly two fields, **Full name** and **Email address**, and a
  **Register** button

**Status:** [ ] Pass [ ] Fail

---

### TC-REG-003: Registering the same email twice is refused and says so

Origin: Backfilled 2026-10-04 from PR #8 (screenshot of `/events/1` after
submitting an email that was already registered: an inline error reading
"<email> is already registered for this event.", with the typed name and email
still in the form).

**Preconditions:** As TC-REG-002.

**Steps:**
1. On the event page, enter a name and an email and click **Register**.
2. Go back to the event page (**Back to events**, then the event's card).
3. Enter any name and the **same** email, and click **Register**.

**Expected Result:**
- After step 3 you stay on the registration form; no confirmation is shown
- An error box under the fields reads "<email> is already registered for this
  event." with the email you typed
- The name and email you typed are still in the fields

**Status:** [ ] Pass [ ] Fail

---

### TC-REGWD-001: The confirmation hands over a link that opens the registration

Origin: Backfilled 2026-10-04 from PR #9 ("register, follow the link from the
confirmation", checked manually against the seeded in-memory adapters).

**Preconditions:** As TC-REG-002, with an email not yet registered for this
event.

**Steps:**
1. On the event page, enter a name and an unused email and click **Register**.
2. In the confirmation, under **Save this link**, click the
   `/registrations/<reference>` link.

**Expected Result:**
- The confirmation includes a **Save this link** box with a
  `/registrations/<reference>` link
- The link opens **Your registration**, reading "Registered as <name>
  (<email>)." and showing the event, with a **Withdraw my registration**
  button

**Status:** [ ] Pass [ ] Fail

---

### TC-REGWD-002: Withdrawing shows a confirmation naming the event (SPM-86)

Origin: Backfilled 2026-10-04 from PR #9 ("withdraw, see the confirmation name
the event", checked manually against the seeded in-memory adapters).

**Preconditions:** On **Your registration** for a live registration, as at the
end of TC-REGWD-001.

**Steps:**
1. Click **Withdraw my registration**.

**Expected Result:**
- "Your registration is withdrawn" appears
- The event's name is shown beneath it

**Status:** [ ] Pass [ ] Fail

---

### TC-REGWD-003: A withdrawn registration reloads as withdrawn with no Withdraw control (SPM-84)

Origin: Backfilled 2026-10-04 from PR #9 ("reload and see it reported as
withdrawn with no Withdraw control", checked manually against the seeded
in-memory adapters).

**Preconditions:** A registration withdrawn as in TC-REGWD-002.

**Steps:**
1. Reload the `/registrations/<reference>` page.

**Expected Result:**
- The page reads "You withdrew this registration, so your place has been
  released."
- There is no **Withdraw my registration** button

**Status:** [ ] Pass [ ] Fail

---

## Cleanup

```sql
delete from public.event where name = 'TC-REG test event';
```

The event's booking and registrations are deleted with it (`on delete
cascade`).
