# Coordinator Queue Manual Tests (SPM-121, SPM-32)

## Overview

Browser checks for the Event Coordinator's own surfaces: the queue of requests
assigned to them (`/staff/coordinator`, SPM-121), the read-only detail of one
(`/staff/coordinator/<id>`, SPM-32), and that both belong to whoever is signed
in, so another coordinator's request, or a non-coordinator, sees nothing.

The rules behind the queue (which statuses it holds and how each is labelled)
are unit-tested. These cases cover what the unit tests cannot: that the
screens show it.

These cases are registered as `TC-COORDQ-001`–`TC-COORDQ-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
  If you have already decided seeded requests in the app, start over with
  `scripts/seed-coordinator-view/teardown.sql` and then `seed.sql`
  (see [`scripts/README.md`](../../scripts/README.md)).
- `pnpm dev:local`
- Browser DevTools open on the **Network** tab (to read the HTTP status)

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |
| `ops@test.com` | Event Coordinator Lead |

### Seeded requests assigned to Test Coordinator

| Request | Stored status | Queue label |
| --- | --- | --- |
| Venue Safety Review | Under Review | Awaiting decision |
| Operations Roadmap Conference | Under Review | Awaiting decision |
| Winter Volunteer Briefing | Submitted | Awaiting decision |
| Vendor Appreciation Day | Returned | With organiser |
| Founders' Gala Dinner | Approved | not in the queue |

`Quarterly Partner Forum` is Submitted and assigned to nobody: from Test
Coordinator's point of view it is someone else's. Call its ID `<not-mine>`:

```sql
select event_request_id from event_request where event_name = 'Quarterly Partner Forum';
```

---

## Test Cases

### TC-COORDQ-001: The queue shows assigned requests in the Coordinator's words

Origin: Backfilled 2026-10-04 from PR #28 (queue screenshot: three requests
"Awaiting decision", one "With organiser"; the unassigned decoy and the
Approved request absent).

**Preconditions:** Seeded as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator`.
2. Read the "Requests assigned to me" table.

**Expected Result:**
- Venue Safety Review, Operations Roadmap Conference and Winter Volunteer
  Briefing read **Awaiting decision**. Under Review and Submitted look the same
  to the Coordinator.
- Vendor Appreciation Day reads **With organiser**.
- Founders' Gala Dinner (Approved) and Quarterly Partner Forum (not assigned to
  this coordinator) are not listed.

**Status:** [ ] Pass [ ] Fail

---

### TC-COORDQ-002: The queue is the signed-in coordinator's own

Origin: Backfilled 2026-10-04 from PR #35 (signed in as `coordinator@test.com`
with no coordinator env var set, saw exactly the requests assigned to that
account, the sidebar count matched, and an assigned request's detail opened).

**Preconditions:** Seeded as above; signed in as `coordinator@test.com`. No
`DEMO_COORDINATOR_USER_ACCOUNT_ID` is needed (it is no longer read).

**Steps:**
1. Count the requests assigned to Test Coordinator that are still in the queue:
   ```sql
   select count(*)
     from event_request r
     join user_account u on u.user_account_id = r.assigned_coordinator_user_account_id
    where u.name = 'Test Coordinator'
      and r.status in ('Submitted', 'Under Review', 'Returned');
   ```
2. Open `/staff/coordinator`. Count the table rows and read the count beside
   "My requests" in the sidebar.
3. Click any request in the table.

**Expected Result:**
- The table lists exactly the requests from step 1 (4 on a fresh seed), and no
  others
- The sidebar count matches
- The request's detail page opens

**Status:** [ ] Pass [ ] Fail

---

### TC-COORDQ-003: An assigned request's detail shows everything submitted, read-only

Origin: Backfilled 2026-10-04 from PR #28 (detail screenshot of Venue Safety
Review: every submitted field shown read-only, unfilled fields as "Not
supplied", time 9:00 AM – 11:00 AM).

**Preconditions:** Seeded as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator`, then click **Venue Safety Review**.
2. Read the "The request as submitted" card.

**Expected Result:**
- The card lists Preferred date, Preferred time, Expected attendance, Room
  layout, Description, Purpose, Venue requirements, Accessibility needs,
  Equipment requirements, Registration requirements, Programme and Other
  arrangements, as text with no input fields
- Fields the Organiser left blank (Room layout, Equipment requirements,
  Registration requirements, Programme, Other arrangements) read **Not
  supplied** rather than being hidden
- Preferred time reads **9:00 AM – 11:00 AM** (Singapore time, as submitted)

**Status:** [ ] Pass [ ] Fail

---

### TC-COORDQ-004: A request assigned to someone else is not shown

Origin: Backfilled 2026-10-04 from PR #35 and PR #33 (a request not assigned
to the coordinator "returns 404"). Since SPM-16 the same request gets the
access-denied screen with a 403; the intent, that the request is not shown,
is unchanged.

**Preconditions:** Seeded as above; signed in as `coordinator@test.com`;
`<not-mine>` found as above.

**Steps:**
1. Open `/staff/coordinator/<not-mine>`.
2. View the page source (Ctrl/Cmd+U) and search for `Quarterly Partner Forum`.

**Expected Result:**
- The access-denied screen naming the Event Coordinator
- Network tab: **403**
- None of the request's details appear, on screen or in the page source

**Status:** [ ] Pass [ ] Fail

---

### TC-COORDQ-005: A non-coordinator cannot open the coordinator pages

Origin: Backfilled 2026-10-04 from PR #35 (`ops@test.com`: `/staff/coordinator`,
`/staff/coordinator/events` and `/staff/coordinator/22` all "return 404").
Since SPM-16 these show the access-denied screen with a 403; the intent, that
none of the coordinator's content is shown, is unchanged.

**Preconditions:** Seeded as above; signed in as `ops@test.com`. Find an
assigned request's ID:

```sql
select event_request_id from event_request where event_name = 'Venue Safety Review';
```

**Steps:**
1. Open `/staff/coordinator`.
2. Open `/staff/coordinator/events`.
3. Open `/staff/coordinator/<id>` with the ID above.

**Expected Result:**
- Each shows the access-denied screen, with a **403** in the Network tab
- No queue, event list or request details are shown

**Status:** [ ] Pass [ ] Fail
