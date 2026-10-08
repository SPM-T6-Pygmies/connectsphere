# Venue Booking Decision Manual Tests (SPM-22)

## Overview

Browser checks for Venue Staff reviewing a coordinator's booking request and
approving or rejecting it, at `/staff/venue` (Requests), `/staff/venue/decided`,
`/staff/venue/archive` and one booking at `/staff/venue/<booking id>`.
Approving stores the booking as **Confirmed** (the ticket's "Approved"; see the
booking States in the domain wiki) and holds the venue for its slots; rejecting
needs a reason and may suggest another venue, informally.

The rules (only a `Requested` booking can be decided, a rejection needs a
reason, an approval may not clash with a slot already held) are unit-tested in
`decideBooking`, tagged `SPM-22`. These cases cover what the unit tests cannot:
the screens on both sides, the messages, and who can reach them.

Not built yet, so not covered: notifying Venue Staff of a new request
(SPM-61), notifying the coordinator of the outcome (SPM-62), and "Hold
tentatively" (SPM-218, SPM-219). The coordinator sees the outcome as the
booking's status on **Request a venue**; the rejection reason and suggestion
are shown to Venue Staff only.

These cases are registered as `TC-VBDECIDE-001`–`TC-VBDECIDE-008` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed, the sample requests and the venues:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  ```
- `pnpm dev:local`

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |
| `venue@test.com` | Venue Staff (Test Venue Staff) |
| `lead@test.com` | Event Coordinator Lead |

### Booking requests to decide

As `coordinator@test.com`, approve two requests from My requests (each opens
its event), call them event A and event B, and from each event's **Request a
venue** page send:

| Event | Venue | Layout | Slots | Used by |
| --- | --- | --- | --- | --- |
| A | Studio | Theatre | its preferred date, AM | TC-VBDECIDE-001, -004 |
| A | Rooftop Terrace | — | its preferred date, PM | TC-VBDECIDE-002, -003 |
| A | Seminar Room 2-1 | Classroom | 2026-12-15, AM | TC-VBDECIDE-005 |
| B | Seminar Room 2-1 | Boardroom | 2026-12-15, AM | TC-VBDECIDE-005 |

`TC-VENUE-BOOK-003` and `-004` leave the first two behind. Find a booking's
ID with:

```sql
select b.booking_id, v.location, b.status, e.name
  from booking b join venue v using (venue_id) join event e using (event_id)
 order by b.booking_id;
```

---

## Test Cases

### TC-VBDECIDE-001: Venue Staff see a coordinator's request beside the venue it asks for (AC1)

**Preconditions:** Bookings set up as above; signed in as `venue@test.com`.

**Steps:**
1. Open `/staff/venue` and read the Requests list.
2. Click the **Studio** request.

**Expected Result:**
- The list holds every `Requested` booking above, each naming its venue
- The detail shows the slots and "requested by Test Coordinator", a
  **Requested** badge, the **Fit against this venue** card (capacity check,
  facilities, supported layouts with Theatre highlighted), the event's card on
  the right, and the **Decision** card with **Approve booking** and **Reject**

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-002: Rejecting without a reason is refused and writes nothing (AC2)

**Preconditions:** As TC-VBDECIDE-001.

**Steps:**
1. Open the **Rooftop Terrace** request.
2. Leave **Note to the coordinator** empty (or only spaces) and click
   **Reject**.
3. Reload.

**Expected Result:**
- An error reads "Give a reason for rejecting this request."
- After reload the booking is still **Requested** with the decision form, and
  still in Requests

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-003: Rejecting with a reason and a suggestion records both; the coordinator sees Rejected (AC2, AC3)

**Preconditions:** As left by TC-VBDECIDE-002.

**Steps:**
1. On the **Rooftop Terrace** request, type "Terrace is closed for resurfacing
   that week." in the note, choose **Main Hall** under **Suggest an
   alternative** and click **Reject**.
2. Open `/staff/venue/archive`.
3. Sign in as `coordinator@test.com` and open event A's **Request a venue**
   page.

**Expected Result:**
- The Decision card reads "Already decided — Rejected by Test Venue Staff",
  with the note and "Suggested instead: Main Hall"; no decision form
- The booking has left Requests and is listed in Archive
- On the coordinator's page the Rooftop Terrace row reads **Rejected**

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-004: Approving confirms the booking; the coordinator sees Confirmed (AC1, AC3)

**Preconditions:** As TC-VBDECIDE-001; signed in as `venue@test.com`.

**Steps:**
1. Open the **Studio** request and click **Approve booking** (no note).
2. Open `/staff/venue/decided`.
3. Sign in as `coordinator@test.com` and open event A's **Request a venue**
   page.

**Expected Result:**
- The Decision card reads "Already decided — Confirmed by Test Venue Staff";
  no decision form
- The booking has left Requests and is listed in Decided
- On the coordinator's page the Studio row reads **Confirmed**

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-005: Approving a slot another booking already holds is refused (business rule)

**Preconditions:** The two Seminar Room 2-1 requests above, both
**Requested**; signed in as `venue@test.com`.

**Steps:**
1. Open event A's Seminar Room 2-1 request and click **Approve booking**.
2. Open event B's Seminar Room 2-1 request and click **Approve booking**.
3. Reload.

**Expected Result:**
- Step 1: Confirmed, as in TC-VBDECIDE-004
- Step 2: an error reads "The venue is already booked for 2026-12-15 AM. Choose
  other slots or another venue."
- After reload event B's booking is still **Requested**

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-006: Only Venue Staff can open the booking pages

**Preconditions:** A booking ID `<booking>` from above.

**Steps:**
1. Signed in as `coordinator@test.com`, open `/staff/venue`, then
   `/staff/venue/<booking>`.
2. Signed in as `lead@test.com`, open the same two URLs.

**Expected Result:**
- Each shows the access-denied screen naming Venue Staff, with a **403**
- No booking, venue or event details are shown

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-007: A block recorded after the request refuses the approval

**Preconditions:** As `coordinator@test.com`, request **Studio** on
**2026-12-08 AM** for event A. Then, as `venue@test.com`, block **Studio** for
**AM** on **2026-12-08** at `/staff/venue/unavailability`, reason Maintenance.
The request is still **Requested**: a block does not change existing bookings.

**Steps:**
1. Signed in as `venue@test.com`, open the Studio 2026-12-08 request and click
   **Approve booking**.
2. Reload the page.

**Expected Result:**
- The form shows *The venue is unavailable for 2026-12-08 AM. Choose other
  slots or another venue.*, the same words the coordinator gets for a blocked
  slot
- After reload the booking is still **Requested**, with the decision form
- Rejecting it instead still works: a rejection holds nothing (do not reject
  it here, TC-VBDECIDE-008 needs it)

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDE-008: Lifting the block lets the approval go through

**Preconditions:** As left by TC-VBDECIDE-007.

**Steps:**
1. At `/staff/venue/unavailability`, lift the Studio 2026-12-08 AM block.
2. Open the Studio 2026-12-08 request and click **Approve booking**.
3. As `coordinator@test.com`, open event A's **Request a venue** page.

**Expected Result:**
- The approval is accepted: *Already decided — Confirmed by Test Venue Staff*
- The booking is listed in **Decided**
- The coordinator's row reads **Confirmed**

**Status:** [ ] Pass [ ] Fail
