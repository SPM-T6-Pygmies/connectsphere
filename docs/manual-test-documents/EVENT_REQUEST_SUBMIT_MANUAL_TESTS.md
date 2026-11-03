# Event Request Submission Manual Tests (SPM-31)

## Overview

Browser checks for an Event Organiser raising a new event request: filling the
form, submitting it, reading the acknowledgement, and finding the request back
on **My event requests**. TC-SUBMIT-003 checks how the form's preferred time
fields display a typed time.

Which fields are mandatory, the future-date rule and the end-after-start rule
are unit-tested; these cases check the page an Organiser actually uses.

These cases are registered as `TC-SUBMIT-001`–`TC-SUBMIT-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

All three were backfilled on 2026-10-04 from checks reported in PR #21 and
PR #23. Each case covers only what its PR said was checked.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the test accounts:
  ```bash
  supabase start
  supabase db reset
  ```
- `pnpm dev:local`

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser@test.com` | Event Organiser |

### Mandatory fields

The form marks five fields required, and **Submit request** stays disabled
until they are all filled: **Event name**, **Preferred date** (must be in the
future), **Preferred start time**, **Preferred end time** (after the start) and
**Expected attendance**.

---

## Test Cases

### TC-SUBMIT-001: Submitting with the mandatory fields shows the acknowledgement

Origin: Backfilled 2026-10-04 from PR #21 (ticked: "My requests → New request →
filled mandatory fields → submitted → acknowledgement screen").

**Preconditions:** Signed in as `organiser@test.com` at `/auth/login`; on
**My event requests** (`/staff/requester`).

**Steps:**
1. Click **New request**.
2. Fill only the five mandatory fields, e.g. Event name `TC-SUBMIT check`, a
   date next month, 10:00 to 12:00, attendance `50`.
3. Click **Submit request**.

**Expected Result:**
- The page changes to **Request submitted** with the event name and a
  **Request ID**
- A **Back to my requests** button is shown

**Status:** [ ] Pass [ ] Fail

---

### TC-SUBMIT-002: The new request is listed on My event requests

Origin: Backfilled 2026-10-04 from PR #21 (ticked: "back to My requests shows
the new submission").

**Preconditions:** A request just submitted as in TC-SUBMIT-001, still on the
acknowledgement.

**Steps:**
1. Click **Back to my requests**.
2. Open the **Submitted** tab.

**Expected Result:**
- The request appears there by its event name, with status **Submitted**

**Status:** [ ] Pass [ ] Fail

---

### TC-SUBMIT-003: A preferred time opens the native picker and shows in 12-hour form

Origin: Backfilled 2026-10-04 from PR #23 (ticked: "the time fields still open
the real native time picker and format typed values correctly (e.g. `14:15` →
`2:15 PM`)").

**Preconditions:** Signed in as `organiser@test.com`; on **New request**
(`/staff/requester/new`).

**Steps:**
1. Look at **Preferred start time** before entering anything.
2. Click it.
3. Enter `14:15`.

**Expected Result:**
- Empty, the field reads `HH:MM AM/PM`
- Clicking opens the browser's own time picker (in browsers that support it;
  otherwise the field still takes typing)
- After entering `14:15`, the field reads `2:15 PM`

**Status:** [ ] Pass [ ] Fail
