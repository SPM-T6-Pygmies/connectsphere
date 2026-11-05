# Staff Role Guards Manual Tests

## Overview

Browser checks that the staff workspaces open for the roles that hold them,
that `/staff/*` is closed to anyone signed out, that the public attendee pages
are not, and that the staff account menu shows who is actually signed in. They
come from the role-guard, account-menu and public-routing changes of
September 2026 (PRs #48, #49, #50), which had no Linear ticket.

What a signed-in user sees on **another role's** workspace is not here: since
SPM-16 that is the access-denied screen with a 403, covered by `TC-DENY-001`–
`TC-DENY-003` in [`ACCESS_DENIED_MANUAL_TESTS.md`](ACCESS_DENIED_MANUAL_TESTS.md).
Signed-out access *after logging out* is `TC-LOGOUT-005` in
[`AUTH_MANUAL_TESTS.md`](AUTH_MANUAL_TESTS.md).

The rules are unit-tested: which workspaces a set of roles opens
(`workspacesFor`) and the staff member's name (`IdentifyStaffMemberResult`).

These cases are registered as `TC-GUARD-001`–`TC-GUARD-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
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
- Browser DevTools open on the **Network** tab (to read the HTTP status). For
  the signed-out cases use a private window, or
  `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000<path>`.

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Name | Role | Own workspace |
| --- | --- | --- | --- |
| `lead@test.com` | Test Coordinator Lead | Event Coordinator Lead | `/staff/lead` |
| `venue@test.com` | Test Venue Staff | Venue Staff | `/staff/venue` |

---

## Test Cases

### TC-GUARD-001: A staff member can open their own workspace's pages

Origin: Backfilled 2026-10-04 from PR #48 (smoke on `pnpm dev:local`: as
`ops@test.com`, `/staff/ops`, `/assigned` and `/notifications` returned 200; as
`venue@test.com`, the Venue pages returned 200).

**Preconditions:** Signed in as each account below in turn.

**Steps:** Open each URL.

| Signed in as | Open |
| --- | --- |
| `lead@test.com` | `/staff/lead`, `/staff/lead/assigned`, `/staff/lead/notifications` |
| `venue@test.com` | `/staff/venue`, `/staff/venue/decided`, `/staff/venue/archive`, `/staff/venue/notifications` |

**Expected Result:**
- Every page loads its own content with a **200**: no access-denied screen, no 404

**Status:** [ ] Pass [ ] Fail

---

### TC-GUARD-002: Signed out, `/staff/*` redirects to login

Origin: Backfilled 2026-10-04 from PR #48 (signed out, `/staff/ops` returns 307
to login) and PR #50 (signed-out probes: `/staff/coordinator` and `/staff/ops`
307 → `/auth/login`).

**Preconditions:** A private window that has never signed in (no `sb-` cookies).

**Steps:**
1. Open `/staff/lead`.
2. Open `/staff/coordinator`.

**Expected Result:**
- Each request answers **307** and lands on `/auth/login`
- No staff content is shown

**Status:** [ ] Pass [ ] Fail

---

### TC-GUARD-003: Public pages open signed out

Origin: Backfilled 2026-10-04 from PR #50 (signed-out probes, after the fix:
`/events` 200 rendering the Events page; `/`, `/auth/login`, `/connections` 200).

**Preconditions:** As TC-GUARD-002.

**Steps:** Open `/events`, `/`, `/auth/login` and `/connections`.

**Expected Result:**
- Each answers **200** and renders its own page; none redirects to `/auth/login`
- `/events` shows the Events list

**Status:** [ ] Pass [ ] Fail

---

### TC-GUARD-004: Event and registration pages are not sent to login when signed out

Origin: Backfilled 2026-10-04 from PR #50 (signed-out probes: `/events/<id>` and
`/registrations/<ref>` answered the page's own 404 instead of 307 →
`/auth/login`; the probe ran against a dummy Supabase URL).

**Preconditions:** As TC-GUARD-002. Any `<id>` and `<ref>` (they need not exist).

**Steps:**
1. Open `/events/<id>`.
2. Open `/registrations/<ref>`.

**Expected Result:**
- Neither redirects to `/auth/login`: each answers from its own page (the event
  or registration, or that page's not-found)

**Status:** [ ] Pass [ ] Fail

---

### TC-GUARD-005: The account menu shows the signed-in user and a single Log out

Origin: Backfilled 2026-10-04 from PR #49 (smoke on `pnpm dev:local` as
`venue@test.com`: the trigger shows "Test Venue Staff / Venue Staff", and the
open menu shows the name, role and a single Log out item).

**Preconditions:** Signed in as `venue@test.com`, on `/staff/venue`.

**Steps:**
1. Look at the account menu trigger at the foot of the sidebar.
2. Click it.

**Expected Result:**
- The trigger reads "Test Venue Staff" over "Venue Staff"
- The open menu shows the same name and role and exactly one item, **Log out**:
  no list of roles or workspaces to switch to

**Status:** [ ] Pass [ ] Fail
