# Event Request Draft Manual Tests (SPM-38)

## Overview

Browser check for an Event Organiser saving an event request as a draft and
resuming it later. It covers the preferred date and time window, which once
came back empty when a draft was reopened (fixed in PR #23).

Saving and reloading a draft's fields is unit-tested; this case checks that the
form really shows them again.

This case is registered as `TC-DRAFT-001` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
it, tick the box below **and** report it in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

Backfilled on 2026-10-04 from the check reported in PR #23.

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

---

## Test Cases

### TC-DRAFT-001: A resumed draft keeps its preferred date and both times

Origin: Backfilled 2026-10-04 from PR #23 (ticked: "picked a date + two times,
saved as a draft, reopened it, and all three fields restored correctly").

**Preconditions:** Signed in as `organiser@test.com`; on **My event requests**
(`/staff/requester`).

**Steps:**
1. Click **New request**. Enter Event name `TC-DRAFT check`.
2. Under **Preferred date**, click **Pick a date** and choose a date next
   month. Set **Preferred start time** to 09:30 and **Preferred end time** to
   11:45.
3. Click **Save draft**. You are returned to **My event requests** with a
   "Draft saved." toast.
4. On the **Drafts** tab, click `TC-DRAFT check` to reopen it.

**Expected Result:**
- The reopened form shows the same preferred date you picked
- **Preferred start time** reads `9:30 AM` and **Preferred end time** reads
  `11:45 AM` — neither shows the empty `HH:MM AM/PM`

**Status:** [ ] Pass [ ] Fail

---

## Cleanup

Reopen the draft and use **Discard draft** → **Yes, discard**, or
`supabase db reset`.
