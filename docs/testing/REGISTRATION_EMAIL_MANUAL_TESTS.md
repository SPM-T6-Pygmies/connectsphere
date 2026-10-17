# Registration Email Manual Tests (SPM-87)

## Overview

Browser and inbox checks for the email an attendee gets when they register
(SPM-87). The email carries the event's name, date, time and venue and the link
to the registration. The confirmation panel no longer shows that link; it says
where the link was sent.

Who gets a notice, and what it carries, is unit-tested under `SPM-304`. The
wording and the Novu trigger are unit-tested under `SPM-305`. These cases check
that the email really arrives and that its link works.

These cases are registered as `TC-REGEMAIL-001`–`TC-REGEMAIL-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

**Any inbox works.** Novu sends through Resend (SPM-308), so the email reaches
whatever address you register with. The steps use
`isaiah.chia.2023@smu.edu.sg`; substitute your own throughout.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seeded venues, as in
  [`EVENT_REGISTRATION_MANUAL_TESTS.md`](EVENT_REGISTRATION_MANUAL_TESTS.md)
- `pnpm dev:local`, with `NOVU_BRIDGE_URL` set in `.env.local` (see the README's
  Notifications section). Without it, the notice is only logged.
- An inbox you can read
- A private/incognito window, so no staff session is involved

### A Confirmed event that is open for registration

Use the **TC-REG test event** from
[`EVENT_REGISTRATION_MANUAL_TESTS.md`](EVENT_REGISTRATION_MANUAL_TESTS.md#a-confirmed-event-that-is-open-for-registration),
with no live registration for the test address. To clear one left over from an
earlier run:

```sql
delete from public.registration
 where attendee_email = 'isaiah.chia.2023@smu.edu.sg';
```

Call the event's id `<event-id>`.

### Test Accounts

None. Attendees register by name and email with no login.

---

## Test Cases

### TC-REGEMAIL-001: Registering emails the event's details and a link (AC1, AC2)

**Preconditions:** The setup event exists; the test address has no live
registration for it; signed out.

**Steps:**
1. Open `/events/<event-id>`.
2. Enter **Full name** `Isaiah Chia` and **Email address**
   `isaiah.chia.2023@smu.edu.sg`, and click **Register**.
3. Open the inbox and find the newest email.

**Expected Result:**
- Within a minute an email arrives with the subject "You're registered:
  TC-REG test event"
- It greets "Hi Isaiah Chia," and gives the event's date, its time "AM (7:00 am
  – 12:00 pm), PM (1:00 pm – 6:00 pm)" and the venue **Main Hall**, the same as
  the on-screen confirmation
- It ends with a `http://localhost:3000/registrations/<reference>` link

**Status:** [x] Pass [ ] Fail

**Screenshots:** [step3-email-received](../screenshots/2026-10-15_TC-REGEMAIL-001_step3-email-received.jpg) · [step3-email-received-via-resend](../screenshots/2026-10-15_TC-REGEMAIL-001_step3-email-received-via-resend.jpg)

---

### TC-REGEMAIL-002: The emailed link opens the registration, where it can be withdrawn (AC3)

**Preconditions:** The email from TC-REGEMAIL-001.

**Steps:**
1. Click the link in the email.

**Expected Result:**
- **Your registration** opens, reading "Registered as Isaiah Chia
  (isaiah.chia.2023@smu.edu.sg)." and showing the event
- A **Withdraw my registration** button is shown. Withdrawing itself is
  TC-REGWD-002.

**Status:** [x] Pass [ ] Fail

**Screenshots:** [step1-emailed-link-opens-registration](../screenshots/2026-10-15_TC-REGEMAIL-002_step1-emailed-link-opens-registration.png)

---

### TC-REGEMAIL-003: The confirmation says where the link was sent and does not show it

**Preconditions:** As TC-REGEMAIL-001.

**Steps:**
1. Register as in TC-REGEMAIL-001, and read the confirmation.

**Expected Result:**
- "You're registered" with the event's name, date, time and venue
- A **Check your email** box reading "We've emailed a link to
  isaiah.chia.2023@smu.edu.sg. Use it to check or withdraw this
  registration."
- No **Save this link** box and no `/registrations/…` link on the page

**Status:** [x] Pass [ ] Fail

**Screenshots:** [step1-confirmation-check-your-email](../screenshots/2026-10-15_TC-REGEMAIL-003_step1-confirmation-check-your-email.png)

---

### TC-REGEMAIL-004: A refused registration sends no email

**Preconditions:** The test address already holds a live registration for the
event, as after TC-REGEMAIL-001.

**Steps:**
1. Open `/events/<event-id>` again.
2. Register with any name and the **same** address.
3. Check the inbox.

**Expected Result:**
- The form stays, with "isaiah.chia.2023@smu.edu.sg is already registered
  for this event."
- No new email arrives

**Status:** [x] Pass [ ] Fail

**Screenshots:** [step2-already-registered](../screenshots/2026-10-15_TC-REGEMAIL-004_step2-already-registered.png)

---

## Cleanup

```sql
delete from public.registration
 where attendee_email = 'isaiah.chia.2023@smu.edu.sg';
```

`pnpm novu:clear` also removes the `<username>-registration-<id>` subscribers
these runs create in Novu.
