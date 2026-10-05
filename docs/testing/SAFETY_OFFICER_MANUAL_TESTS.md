# Safety Officer Role Manual Tests

## Overview

Browser checks for **SPM-258 — Safety Officer role**: a seeded Safety Officer
can sign in, lands in their own `/staff/safety` workspace with its own
navigation, and the access-denied screen keeps that workspace and every other
role's apart in both directions.

What SPM-258 does **not** cover, so is not tested here:

- **Recording a safety check outcome**, and refusing it to anyone else — SPM-260.
- **Which events are listed** in the workspace — SPM-259
  ([`SAFETY_CHECK_LIST_MANUAL_TESTS.md`](SAFETY_CHECK_LIST_MANUAL_TESTS.md)). On
  a freshly reset database the list is empty: "No events awaiting a safety check".

The rules are unit-tested (`Safety Officer role (SPM-258)`,
`Safety Officer navigation (SPM-258)`, `LoginUseCase for a Safety Officer
(SPM-258)`): which workspace the role opens and lands on, who the denial screen
names, where it sends a Safety Officer back to, and the rail's entries. These
cases check the same rules end to end, through the real login, the seeded
accounts and the HTTP status.

These cases are registered as `TC-SAFETY-001`–`TC-SAFETY-006` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the new role and its accounts exist:
  ```bash
  supabase start
  supabase db reset
  ```
  No sample events are needed — on a fresh database the safety workspace lists nothing.
- `pnpm dev:local` (or `pnpm dev` with `.env.local` pointing at the local stack)
- Browser DevTools open on the **Network** tab, to read the HTTP status of the
  document request. For TC-SAFETY-006 use a private window, or
  `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/staff/safety`.

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Name | Role | Own workspace |
| --- | --- | --- | --- |
| `safety@test.com` | Test Safety Officer | Safety Officer | `/staff/safety` |
| `organiser@test.com` | Test Organiser | Event Organiser | `/staff/requester` |
| `coordinator@test.com` | Test Coordinator | Event Coordinator | `/staff/coordinator` |
| `ops@test.com` | Test Ops Manager | Event Operations Manager | `/staff/ops` |
| `venue@test.com` | Test Venue Staff | Venue Staff | `/staff/venue` |
| `support@test.com` | Test Support Staff | Technical Support Staff | `/staff/technical` |

---

## Test Cases

### TC-SAFETY-001: A seeded Safety Officer signs in to their own workspace

AC2, AC3, AC4.

**Preconditions:** Signed out.

**Steps:**
1. Open `/auth/login` and sign in as `safety@test.com`.
2. Note the URL you land on.
3. Open the account menu (bottom of the rail).

**Expected Result:**
- Step 2: `/staff/safety`
- Step 3: the menu names **Test Safety Officer** and the role **Safety Officer**

**Evidence:** [`2026-10-05_TC-SAFETY-001_step3-account-menu-names-role.png`](../screenshots/2026-10-05_TC-SAFETY-001_step3-account-menu-names-role.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETY-002: The safety workspace has its own navigation

AC4.

**Preconditions:** Signed in as `safety@test.com`, on `/staff/safety`, desktop width.

**Steps:**
1. Read the rail, the list pane, the breadcrumb and the page.
2. Choose **Notifications** in the rail.

**Expected Result:**
- Step 1: the rail holds **Awaiting check** and **Notifications** only, and
  every link in it stays under `/staff/safety`; the breadcrumb reads
  **Safety Officer › Awaiting check**; the page shows "No events awaiting a
  safety check"
- Step 2: `/staff/safety/notifications` loads with a **200** and shows the inbox

**Evidence:**
[`2026-10-05_TC-SAFETY-002_step1-rail-and-empty-state.png`](../screenshots/2026-10-05_TC-SAFETY-002_step1-rail-and-empty-state.png),
[`2026-10-05_TC-SAFETY-002_step2-notifications-inbox.png`](../screenshots/2026-10-05_TC-SAFETY-002_step2-notifications-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETY-003: Every other staff role is refused the safety workspace

AC5.

**Preconditions:** Signed in as each account below in turn.

**Steps:**
1. Open `/staff/safety`, then `/staff/safety/notifications`, and read the
   screen and the document request's status.
2. Note where **Go back to your workspace** points.
3. As `coordinator@test.com`, press **Go back to your workspace**.

| Signed in as | Go back to your workspace |
| --- | --- |
| `organiser@test.com` | `/staff/requester` |
| `coordinator@test.com` | `/staff/coordinator` |
| `ops@test.com` | `/staff/ops` |
| `venue@test.com` | `/staff/venue` |
| `support@test.com` | `/staff/technical` |

**Expected Result:**
- Every URL in step 1 answers **403** with "You don't have access to this
  page." and "Please contact your respective **Safety Officer**." — no safety
  content, no 404
- Step 2: the link points at the account's own workspace, per the table
- Step 3: the Coordinator lands on `/staff/coordinator`

**Evidence:**
[`2026-10-05_TC-SAFETY-003_step1-coordinator-denied-safety-area.png`](../screenshots/2026-10-05_TC-SAFETY-003_step1-coordinator-denied-safety-area.png),
[`2026-10-05_TC-SAFETY-003_step3-coordinator-back-in-own-workspace.png`](../screenshots/2026-10-05_TC-SAFETY-003_step3-coordinator-back-in-own-workspace.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETY-004: A Safety Officer is refused every other role's workspace

AC6.

**Preconditions:** Signed in as `safety@test.com`.

**Steps:**
1. Open each URL below and read the screen and the document request's status.
2. On `/staff/ops`, press **Go back to your workspace**.

| Open | Contact named |
| --- | --- |
| `/staff/requester` | Event Organiser |
| `/staff/coordinator` | Event Coordinator |
| `/staff/ops` | Event Operations Manager |
| `/staff/venue` | Venue Staff |
| `/staff/technical` | Technical Support Staff |

**Expected Result:**
- Step 1: each answers **403** with the access-denied screen naming the
  contact in the table, and **Go back to your workspace** points at
  `/staff/safety`
- Step 2: lands on `/staff/safety`

**Evidence:** [`2026-10-05_TC-SAFETY-004_step1-safety-officer-denied-ops-area.png`](../screenshots/2026-10-05_TC-SAFETY-004_step1-safety-officer-denied-ops-area.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETY-005: The safety workspace and its denial screen work on a phone

AC4, AC7.

**Preconditions:** Signed in as `safety@test.com`; DevTools device toolbar at
390 × 844 (iPhone 12/13/14).

**Steps:**
1. Open `/staff/safety`.
2. Open `/staff/ops`.

**Expected Result:**
- Step 1: the bottom bar shows the Awaiting check and Notifications entries;
  the list is headed **Awaiting check** and reads "Nothing here."; no sideways
  scroll
- Step 2: the access-denied screen fits the width with its full-width button;
  **403**; no sideways scroll

**Evidence:**
[`2026-10-05_TC-SAFETY-005_step1-mobile-workspace-bottom-nav.png`](../screenshots/2026-10-05_TC-SAFETY-005_step1-mobile-workspace-bottom-nav.png),
[`2026-10-05_TC-SAFETY-005_step2-mobile-access-denied.png`](../screenshots/2026-10-05_TC-SAFETY-005_step2-mobile-access-denied.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETY-006: Signed out, the safety workspace sends you to login

AC5.

**Preconditions:** A private window that has never signed in (no `sb-` cookies).

**Steps:** Open `/staff/safety`.

**Expected Result:**
- The request answers **307** and lands on `/auth/login`; no safety content is shown

**Evidence:** [`2026-10-05_TC-SAFETY-006_step1-signed-out-sent-to-login.png`](../screenshots/2026-10-05_TC-SAFETY-006_step1-signed-out-sent-to-login.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-05

Run by Claude Code for arinmakk on branch `feat/spm-258-safety-officer-role`,
against `pnpm dev` (Next.js 16.3.4, dev mode) on a fresh local Supabase
(`supabase db reset`), in headless Chromium driven by Playwright — desktop at
1440 × 900, phone at 390 × 844. The round "N" in the bottom-left corner of the
screenshots is the Next.js dev-mode indicator, not part of the app.

| Case | Result | Observed |
| --- | --- | --- |
| TC-SAFETY-001 | Pass | Landed on `/staff/safety`; menu: "Test Safety Officer · Safety Officer · Log out" |
| TC-SAFETY-002 | Pass | Rail links `/staff/safety`, `/staff/safety/notifications` only; breadcrumb "Safety Officer › Awaiting check"; empty state shown; inbox 200 |
| TC-SAFETY-003 | Pass | All 10 URLs (5 accounts × 2) 403 "Please contact your respective Safety Officer."; each way back is the account's own workspace; Coordinator returned to `/staff/coordinator` |
| TC-SAFETY-004 | Pass | All 5 areas 403 naming their owner; way back `/staff/safety` each time, and followed |
| TC-SAFETY-005 | Pass | Bottom bar visible, no sideways scroll; `/staff/ops` 403 with no sideways scroll |
| TC-SAFETY-006 | Pass | 307 → `/auth/login` |

No page errors were raised in the browser during the run.
