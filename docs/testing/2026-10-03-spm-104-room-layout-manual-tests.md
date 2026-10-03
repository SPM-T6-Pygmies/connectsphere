# Room Layout on a Booking — Manual Tests (SPM-104)

## Overview

Browser checks for the acceptance criteria of SPM-104 that the unit tests
cannot show on screen: a booking cannot be sent without a supported layout, the
capacity check reads the chosen layout's figure, a search's layout is carried
into the booking, and changing the layout re-runs the check.

The rules themselves are unit-tested (tagged `SPM-104`): `chooseRoomLayout`,
`checkLayoutCapacity` and `layoutFromSearch`, and the three use cases that use
them.

## Where these were run — read this first

SPM-46's real booking page (PR #75) is not on `main`, and there is no Docker or
Supabase in the sandbox these were run in. So the cases were run on a
**throwaway demo page** (`src/app/dev-spm-104/`, untracked, not committed) that
calls the real use cases over in-memory data. That proves the rules behave as
described on screen; it does **not** prove the real booking form does. Re-run
these on PR #75's booking form once SPM-104 is merged with it, then set
`Status`, `ExecutedBy` and `LastPassedDate` on the registry rows.

The sandbox run on 2026-10-03 passed every check below. Screenshots are in
[`../screenshots/`](../screenshots/) and prefixed `2026-10-03-spm-104-`.

## Test Data

| Venue | Venue-wide capacity | Layouts (capacity) |
| --- | --- | --- |
| Harbour Hall | 999 | Theatre 200, Boardroom 20 |
| Marina Room | 60 | Boardroom 40, Classroom 60 |

Event `e1` expects 100 people. The venue-wide 999 is deliberately unlike every
layout figure, so any check that read it would visibly give the wrong answer.

---

### TC-LAYOUT-001 — A booking with no layout is refused (AC2)

1. Choose Harbour Hall; leave the layout on "— none chosen —".
2. Send the booking request.

**Expected:** "Choose the room layout this booking assumes." No booking appears.
`2026-10-03-spm-104-mt-001-step2-refused-layout-required.png`

### TC-LAYOUT-002 — A layout the venue does not support is refused (AC1)

1. Choose Harbour Hall and the Banquet layout. Send.

**Expected:** "This venue does not support the Banquet layout." No booking appears.
`2026-10-03-spm-104-mt-002-step2-refused-unsupported-layout.png`

### TC-LAYOUT-003 — Search matches on one layout's capacity (AC4)

1. Search Boardroom for 100 people.

**Expected:** "No venues found" — Harbour Hall's Boardroom seats 20 and Marina
Room's 40, even though Harbour Hall's venue-wide figure is 999.
`2026-10-03-spm-104-mt-003-search-boardroom-100-no-venues.png`

### TC-LAYOUT-004 — The searched layout is carried into the booking (AC4, AC1)

1. Search Theatre for 100 people. Only Harbour Hall is listed.
2. Choose "Request booking".
3. Send the request without touching the layout.

**Expected:** the venue and Theatre are already selected on the form; the booking
is saved with the Theatre layout and its check reads "Theatre seats 200 … within
capacity".
`mt-004-step1…`, `mt-004-step2…`, `mt-004-step3…`

### TC-LAYOUT-005 — Changing the layout re-runs the check on the new layout (AC3, AC5)

1. On the Theatre booking, change the layout to Boardroom.
2. Change it back to Theatre.

**Expected:** after step 1 the check reads "Boardroom seats 20 … OVER capacity"
(not 999); after step 2 "Theatre seats 200 … within capacity".
`mt-005-step1…` to `mt-005-step3…`

### TC-LAYOUT-006 — The check uses the event's current attendance (AC3)

With the booking on Boardroom (seats 20):

1. Set expected attendance to 20. 2. Set it to 21.

**Expected:** 20 is within capacity (exactly at the figure); 21 is OVER capacity
(one above).
`mt-006-step1…`, `mt-006-step2…`

### TC-LAYOUT-007 — A refused change leaves the booking as it was (AC1, AC2, AC5)

1. Change the layout to "— none chosen —". 2. Change it to Classroom (not
supported at Harbour Hall).

**Expected:** each is refused with its message and the booking still shows
Boardroom.
`mt-007-step1…`, `mt-007-step2…`

### TC-LAYOUT-008 — A decided booking's layout is locked (not in the ticket)

1. Mark the booking Confirmed. 2. Try to change its layout.

**Expected:** "The layout of a Confirmed booking can no longer be changed."
This is an **assumption**, not an acceptance criterion — confirm it with the team.
`mt-008-confirmed-booking-layout-locked.png`

---

## Not covered here

- The size of the over-capacity consequence (block or warning) — SPM-107, open.
- Which of `venue.capacity` or the layout figure wins — SPM-106, open.
- Slots, clash blocking and who may ask — SPM-46.
