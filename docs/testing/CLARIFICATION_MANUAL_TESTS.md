# Clarification Manual Tests (SPM-33)

## Overview

Browser checks for the clarification exchange on an event request: the
Coordinator asks the Organiser a question and returns the request, both sides
reply in that question's thread, and the Coordinator resolves each question
separately. The request goes back to `Under Review` only when the last open
question is resolved.

The rules (which messages keep a request with the Organiser, when it resumes,
that a `Returned` request can still be decided) are unit-tested, tagged
`SPM-33`. These cases cover what the unit tests cannot: the two screens, the
status each side sees, and the live refresh between them.

These cases are registered as `TC-CLARIFY-001`–`TC-CLARIFY-008` in
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
- `pnpm dev:local`
- Two browser profiles (or one normal and one private window), so both roles
  can be signed in at once

### Test Accounts

Password for both: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Sees the request at |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | `/staff/coordinator/<id>` |
| `organiser@test.com` | Event Organiser (requested both requests below) | `/staff/requester/<id>` |

### Requests used

| Request | Seeded status | Used by |
| --- | --- | --- |
| Venue Safety Review | Under Review | TC-CLARIFY-001 to -008, in order |
| Vendor Appreciation Day | Returned | TC-CLARIFY-008 |

```sql
select event_request_id, event_name, status
  from event_request
 where event_name in ('Venue Safety Review', 'Vendor Appreciation Day');
```

Run the cases in order: each starts from the state the previous one left.
On the Coordinator's screen the request's badge reads **Awaiting decision**
for `Under Review` and **With organiser** for `Returned`; the Organiser's
screen shows the stored status.

---

## Test Cases

### TC-CLARIFY-001: "Comment" posts without returning the request (AC5)

Origin: Backfilled 2026-10-04 from PR #57 (ticked: on an Under Review request,
"Comment" posts and the request stays in the decision queue; checked against
the local stack).

**Preconditions:** Signed in as `coordinator@test.com`; Venue Safety Review is
Under Review.

**Steps:**
1. Open Venue Safety Review from `/staff/coordinator`.
2. In the Clarification card's bottom box, type "Noting the fire-exit list for
   the venue team." and click **Comment**.
3. Open `/staff/coordinator`.

**Expected Result:**
- The message appears in the thread
- The request's badge still reads **Awaiting decision**, and it is still in
  My requests reading Awaiting decision

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-002: "Comment & return" returns the request and records it

Origin: Backfilled 2026-10-04 from PR #57 (ticked: "Comment & return" moves
the request to Returned and writes an audit row; local stack).

**Preconditions:** As left by TC-CLARIFY-001.

**Steps:**
1. On Venue Safety Review, type "Which two attendees need step-free access, and
   to which rooms?" and click **Comment & return**.
2. Check the audit trail:
   ```sql
   select action, occurred_at
     from audit_record
    where entity_type = 'event_request'
      and entity_id = <Venue Safety Review id>
    order by occurred_at desc
    limit 1;
   ```

**Expected Result:**
- The badge reads **With organiser** (status `Returned`)
- The newest audit row for the request has `action = 'returned'`

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-003: Resolving one of two open questions leaves the request Returned

Origin: Backfilled 2026-10-04 from PR #57 (ticked: two returns open two
questions, resolving the first leaves the request Returned; coordinator
screenshot shows two resolved questions and one open, request "With
organiser").

**Preconditions:** As left by TC-CLARIFY-002 (one open question).

**Steps:**
1. On Venue Safety Review, type "Is the main hall needed all morning?" and
   click **Comment & return**. Two questions now read "Awaiting an answer".
2. Click **Resolve** on the first question.

**Expected Result:**
- The first question reads **Resolved**; the second still reads "Awaiting an
  answer" with its own **Resolve**
- The badge still reads **With organiser**

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-004: Resolving the last open question puts the request back to Under Review

Origin: Backfilled 2026-10-04 from PR #57 (ticked: resolving the last puts it
back to Under Review; organiser screenshot shows every question resolved and
the request "Under Review").

**Preconditions:** As left by TC-CLARIFY-003 (one question still open).

**Steps:**
1. On Venue Safety Review, click **Resolve** on the remaining open question.
2. As `organiser@test.com`, open `/staff/requester/<Venue Safety Review id>`.

**Expected Result:**
- Coordinator: every question reads **Resolved**, and the badge reads
  **Awaiting decision**
- Organiser: the status badge reads **Under Review**

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-005: A reply inside a thread doesn't resume the request

Origin: Backfilled 2026-10-04 from PR #57 (ticked: a reply inside a thread
doesn't resume the request; browser, both surfaces).

**Preconditions:** As left by TC-CLARIFY-004.

**Steps:**
1. Coordinator: on Venue Safety Review, type "Will the walkthrough need a
   key-holder?" and click **Comment & return**.
2. Organiser: on `/staff/requester/<id>`, in that question's **Leave a
   reply…** box, type "Yes, facilities will send one." and click **Reply**.
3. Coordinator: reload, then reply in the same thread ("Thanks.") with
   **Reply**.
4. Reload both screens.

**Expected Result:**
- Both replies appear under the question
- Coordinator's badge still reads **With organiser**; Organiser's status still
  reads **Returned**
- The question still reads "Awaiting an answer"

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-006: The Organiser can reply, but cannot resolve or edit (AC7)

Origin: Backfilled 2026-10-04 from PR #57 (ticked: Organiser at
`/staff/requester/<id>` can reply, sees no Resolve and no editable field;
organiser screenshot shows Reply boxes and no Resolve).

**Preconditions:** As left by TC-CLARIFY-005; signed in as `organiser@test.com`.

**Steps:**
1. Open `/staff/requester/<Venue Safety Review id>`.
2. Look over every thread and the "Your request" card.
3. Reply in the open thread ("Also the east stairwell.") with **Reply**.

**Expected Result:**
- The reply posts and appears under the question
- No **Resolve** button on any question
- The request's fields are text only, with no input to change them

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-007: A message on one side shows up on the other without a reload

Origin: Backfilled 2026-10-04 from PR #57 (ticked: with both roles open in two
browsers, a message posted on one side shows up on the other within ~15s
without a reload).

**Preconditions:** As left by TC-CLARIFY-006. Coordinator and Organiser each
have Venue Safety Review open, in two browsers, both tabs visible.

**Steps:**
1. Coordinator: reply in the open thread "Noted." Do not touch the Organiser's
   window.
2. Wait up to 20 seconds, watching the Organiser's window.
3. Organiser: reply "Thank you." Wait up to 20 seconds, watching the
   Coordinator's window.

**Expected Result:**
- Each message appears on the other side within about 15 seconds, without a
  manual reload

**Status:** [ ] Pass [ ] Fail

---

### TC-CLARIFY-008: A Returned request can be approved or rejected without resolving first

Origin: Backfilled 2026-10-04 from PR #57 (ticked: approving or rejecting a
Returned request directly works without resolving first).

**Preconditions:** As left by TC-CLARIFY-007: Venue Safety Review is Returned
with an open question. Vendor Appreciation Day is Returned as seeded. Signed
in as `coordinator@test.com`.

**Steps:**
1. Open Vendor Appreciation Day. The Decision card shows Approve/Reject and
   says "This one is with the organiser, and you can still decide it."
   Click **Approve**.
2. Open Venue Safety Review. Without resolving the open question, type a
   reason ("Superseded by the November audit") and click **Reject**.

**Expected Result:**
- Vendor Appreciation Day: **Outcome: Approved -- planning can begin**
- Venue Safety Review: **Outcome: Rejected** with the reason shown
- Neither decision asks for the open question to be resolved first

**Status:** [ ] Pass [ ] Fail
