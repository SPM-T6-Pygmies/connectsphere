# Request Times Manual Tests (SPM-327)

## Overview

Browser checks that an Event Organiser requests an event with a preferred
start and end time on the 15-minute grid, not AM, PM or Night slots, after
`event_request_slot` moved to the 15-minute grid (SPM-276 team decision 6).

- A request's preferred time is one span on its preferred date, stored as the
  15-minute slots it covers, `event_request_slot.slot_code` `'0'`–`'95'`.
- Times are entered in venue time and labelled GMT+8. Request pages show them
  in the **viewer's timezone**, named outside Singapore.
- Approving a request gives the new event the requested times
  (`coordinator_decide_event_request`, unchanged since SPM-326).

The rules are unit-tested and tagged `SPM-327`: the grid, the end-after-start
rule and its boundaries, drafts, the slot-code mapping both ways and the
schema's time shape. These cases cover what the unit tests cannot: the
migration rewriting real rows, the form, and each page rendering a stored
request.

These cases are registered as `TC-REQTIME-001`–`TC-REQTIME-006` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report each
run in the PR description's `## Manual test results` table.

---

## Test Environment Setup

1. Reset the local database, which applies
   `20261021000100_event_request_slots_fifteen_minute_grid.sql`:
   ```bash
   supabase db reset
   ```
2. `pnpm dev` against the local stack. Sign in as `organiser@test.com`,
   `lead@test.com` or `coordinator@test.com` (password `TestPass123!`) as each
   case says.

---

## Test Cases

### TC-REQTIME-001: Existing AM, PM and Night request slots become one span

**Preconditions:** Before the migration: `supabase db reset --version 20261021000000`,
then requests with these `event_request_slot` rows on their preferred date:
AM; AM and PM; AM and Night (a Draft); Night; none (a Draft); AM, PM and Night.

**Steps:**
1. Apply the migration with `psql -f` so its notices print (or
   `supabase migration up`).
2. Run:
   ```sql
   select event_request_id, count(*), min(slot_code::int), max(slot_code::int)
   from event_request_slot group by 1 order by 1;
   ```
3. Insert a `'PM'` row into `event_request_slot`.

**Expected Result:**
- AM gives 20 rows, `'28'`–`'47'` (07:00–12:00). Night gives 20 rows,
  `'76'`–`'95'` (19:00–24:00).
- AM and PM give one span of 44 rows, `'28'`–`'71'` (07:00–18:00). AM and
  Night, and all three, give 68 rows, `'28'`–`'95'` (07:00–24:00).
- The request with no slots still has none. No request is lost.
- The migration prints a notice for each request whose range widened, e.g.
  `Event request 902 on 2026-12-02 widened to 07:00-18:00`.
- The `'PM'` insert is refused by `event_request_slot_fifteen_minute_chk`.

**Status:** [x] Pass [ ] Fail

---

### TC-REQTIME-002: Request an event by start and end time

**Preconditions:** Environment set up; browser in Singapore time; signed in
as `organiser@test.com`.

**Steps:**
1. Open `/staff/requester/new`.
2. Enter a name, pick a date next month, start 09:15, end 17:45, attendance 60.
3. Submit.

**Expected Result:**
- The "When and how many" card offers "Start time (GMT+8)" from 00:00 to 23:45
  and "End time (GMT+8)" from 00:15 to 24:00, every 15 minutes. No AM, PM or
  Night anywhere on the form.
- The acknowledgement reads "Preferred date & time: <dd/mm/yyyy>, 9:15 am –
  5:45 pm".
- `preferred_slots` for the request is `'37'`–`'70'`.

**Status:** [x] Pass [ ] Fail

---

### TC-REQTIME-003: An end time not after the start is named

**Preconditions:** As TC-REQTIME-002.

**Steps:**
1. Fill the form as in TC-REQTIME-002, but with end 08:45.
2. Submit.

**Expected Result:**
- The banner reads "Check the highlighted fields." and the End time field
  reads "The end time must be after the start time."
- Start 09:15 and end 08:45 are still selected, so only the end needs fixing.

**Status:** [x] Pass [ ] Fail

---

### TC-REQTIME-004: Drafts keep their times, or have none

**Preconditions:** As TC-REQTIME-002.

**Steps:**
1. Open `/staff/requester/new`, enter a name and a date, choose start 13:30
   and no end, and Save draft.
2. Choose end 24:00 and Save draft.
3. Reopen the draft from My requests.
4. Start a new request with only a name and Save draft.

**Expected Result:**
- Step 1 is refused: "Choose both a start and an end time, or neither, before
  saving a draft."
- Step 2 saves. Reopened, the draft shows start 13:30 and end 24:00.
- Step 4 saves with no date and no times.

**Status:** [x] Pass [ ] Fail

---

### TC-REQTIME-005: Request pages show the preferred time in the viewer's timezone

**Preconditions:** The TC-REQTIME-002 request, assigned to
`coordinator@test.com` (by the Lead, or
`update event_request set assigned_coordinator_user_account_id = …, status = 'Under Review'`).

**Steps:**
1. In Singapore time, open the request as the Organiser
   (`/staff/requester/<id>`), the Lead (`/staff/lead/<id>`) and the
   Coordinator (`/staff/coordinator/<id>`).
2. Repeat with the browser timezone set to Europe/London.

**Expected Result:**
- Each page has a "Preferred time" row reading "9:15 am – 5:45 pm" in
  Singapore, and "1:15 am – 9:45 am (GMT)" in London.
- No page shows "Preferred slots", AM, PM or Night.

**Status:** [x] Pass [ ] Fail

---

### TC-REQTIME-006: Approval gives the event the requested times

**Preconditions:** The TC-REQTIME-005 request, assigned and Under Review.

**Steps:**
1. As `coordinator@test.com`, open the request and Approve it.
2. As `organiser@test.com`, open the request.

**Expected Result:**
- The Organiser's request shows "Event times: <d Mon> 9:15 am – 5:45 pm".
- The new event has 34 `event_slot` rows on the preferred date, from 09:15 to
  17:45.

**Status:** [x] Pass [ ] Fail
