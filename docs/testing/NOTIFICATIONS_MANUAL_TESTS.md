# Notifications Manual Tests (SPM-57)

## Overview

Browser checks for the staff notification inbox: a coordinator learning of
their assignment (SPM-57), the inbox fed from Novu (SPM-174), triaging
notifications with read/unread and archive (SPM-179), and per-type channel
preferences (SPM-180). They cover what the unit tests cannot: that Novu really
delivers to the right inbox, that the list, dots and counts follow Novu's state
live, and that preferences persist in Novu.

The rules behind them are unit-tested (tagged `SPM-172`, `SPM-173`, `SPM-180`):
who is notified on assignment and reassignment, the in-app wording and its
redirect, and the workflow's locked preference. Delivery and server logs
(`[notifier] ...` lines, `notification` table rows, Novu's Activity Feed) are
not user-facing and are not cases here.

These cases are registered as `TC-NOTIFY-001`–`TC-NOTIFY-012` in
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
  pnpm novu:clear   # after a reset: old notifications point at reused request ids
  ```
- `pnpm dev:local` — starts the app behind a `novu dev` tunnel with env from
  Infisical `dev`. `NOVU_BRIDGE_URL` must be set to the tunnel URL it prints
  (one-off; see README → Notifications). Without it, notifications are only
  logged and nothing reaches an inbox.
- Locally, Novu's Development environment is shared, so the app sends to
  `<your username>-<user_account_id>`: you only see your own notifications.

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Inbox |
| --- | --- | --- |
| `ops@test.com` | Event Operations Manager | assigns coordinators at `/staff/ops/<id>` |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) | `/staff/coordinator/notifications` |
| `coordinator2@test.com` | Event Coordinator (Test Coordinator 2) | `/staff/coordinator/notifications` |

### Creating an assignment notification

Several cases need a "Coordinator assigned" notification in
`coordinator@test.com`'s inbox. Quarterly Partner Forum is seeded Submitted and
unassigned for this:

1. Sign in as `ops@test.com`, open `/staff/ops` and select **Quarterly Partner Forum**.
2. Under **Assign a coordinator**, choose Test Coordinator and click **Assign coordinator**.
3. Sign out.

Its ID (`<qpf>` below) is in the URL of step 1.

---

## Test Cases

### TC-NOTIFY-001: The inbox lists the coordinator's assignment notifications (SPM-174)

Origin: Backfilled 2026-10-04 from PR #67 (as `coordinator@test.com` under
`pnpm dev:local` with the Novu dev key, the list pane showed the Novu
notifications and the page showed "0 unread notifications").

**Preconditions:** An assignment notification exists for Test Coordinator and
has already been opened (read). Signed in as `coordinator@test.com`.

**Steps:**
1. Click the Notifications (bell) entry in the rail, or open `/staff/coordinator/notifications`.

**Expected Result:**
- The list pane, headed "Notifications", shows the notification "Quarterly
  Partner Forum has been assigned to you" with a "Coordinator assigned" badge
  and its body ("... for Test Organisation is now yours to review. Requested for ...")
- The page shows "0 unread notifications"

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-002: Opening a notification shows the assigned request beside the list (AC5)

Origin: Backfilled 2026-10-04 from PR #67 (opening "Quarterly Partner Forum has
been assigned to you" showed the request under
`/staff/coordinator/notifications/<id>`, with the list still open).

**Preconditions:** As TC-NOTIFY-001.

**Steps:**
1. In the list pane, click "Quarterly Partner Forum has been assigned to you".

**Expected Result:**
- The URL is `/staff/coordinator/notifications/<qpf>`
- The page shows the Quarterly Partner Forum request; the trail reads
  "Event Coordinator > Notifications > Quarterly Partner Forum"
- The notification list stays open beside it

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-003: Opening an unread notification clears its dot and the count (AC6)

Origin: Backfilled 2026-10-04 from PR #67 (listed unticked: "not yet seen on an
unread one").

**Preconditions:** A new, unread assignment notification for Test Coordinator
(create one as above, or use TC-NOTIFY-006 to mark one unread). Signed in as
`coordinator@test.com`, on `/staff/coordinator/notifications`.

**Steps:**
1. Note the dot on the row, the dot on the rail's bell and the "N unread" count.
2. Click the notification.

**Expected Result:**
- The row's dot and the bell's dot disappear
- The unread count drops by one (the "unread" badge disappears at zero)

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-004: Assigning a coordinator delivers a notification to their inbox

Origin: Backfilled 2026-10-04 from PR #67 (listed unticked: as `ops@test.com`,
assign a coordinator; the notification appears in `coordinator@test.com`'s inbox
and opens the request).

**Preconditions:** `pnpm novu:clear` run; Quarterly Partner Forum unassigned
(fresh seed).

**Steps:**
1. As `ops@test.com`, assign Test Coordinator to Quarterly Partner Forum (see
   "Creating an assignment notification").
2. Sign out, sign in as `coordinator@test.com`, open `/staff/coordinator/notifications`.
3. Click the notification.

**Expected Result:**
- One unread notification "Quarterly Partner Forum has been assigned to you",
  badged "Coordinator assigned"
- Clicking it opens the Quarterly Partner Forum request

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-005: Reassigning notifies only the new coordinator (AC4)

Origin: Backfilled 2026-10-04 from PR #63 (listed unticked, as a server-log
check: "Reassign the request to a different coordinator. One line is logged,
and it names the new coordinator"). Written here against the inbox, which did
not exist at the time.

**Preconditions:** TC-NOTIFY-004 done (Test Coordinator holds Quarterly Partner
Forum and has its notification). `coordinator2@test.com`'s inbox is empty.

**Steps:**
1. As `ops@test.com`, open Quarterly Partner Forum. Under **Reassign
   coordinator**, choose Test Coordinator 2 and click **Reassign**.
2. Sign in as `coordinator2@test.com` and open the inbox.
3. Sign in as `coordinator@test.com` and open the inbox.

**Expected Result:**
- `coordinator2@test.com` has one new "Quarterly Partner Forum has been
  assigned to you" notification
- `coordinator@test.com` has nothing new: only the original assignment notification

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-006: "Mark as unread" brings back the dot and the count (SPM-179)

Origin: Backfilled 2026-10-04 from PR #69 ("Mark as unread" brought back the dot
and the count, "1 unread notification").

**Preconditions:** Signed in as `coordinator@test.com`, on
`/staff/coordinator/notifications`, with exactly one notification, already read
("0 unread notifications").

**Steps:**
1. Hover the row and click **Mark as unread** (envelope icon).

**Expected Result:**
- The row shows its unread dot; the rail's bell shows a dot
- The list header shows "1 unread" and the page shows "1 unread notification"

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-007: "Archive" moves a notification to Archived (SPM-179)

Origin: Backfilled 2026-10-04 from PR #69 ("Archive" moved it to Archived, and
the heading and placeholder followed).

**Preconditions:** As TC-NOTIFY-006.

**Steps:**
1. Hover the row and click **Archive**.
2. Open the list's ··· menu (Notification options) and choose **Archived**.

**Expected Result:**
- After step 1 the notification leaves the Inbox list
- After step 2 the list heading reads "Archived", the notification is listed,
  and the page shows "1 archived notification"

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-008: "Unarchive" moves it back to the Inbox (SPM-179)

Origin: Backfilled 2026-10-04 from PR #69 ("Unarchive" moved it back).

**Preconditions:** TC-NOTIFY-007 done; in the Archived view.

**Steps:**
1. Hover the row and click **Unarchive**.
2. In the ··· menu choose **Inbox**.

**Expected Result:**
- The notification leaves the Archived list ("Nothing archived.")
- It is listed again in the Inbox, headed "Notifications"

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-009: "Mark all read" clears the unread count (SPM-179)

Origin: Backfilled 2026-10-04 from PR #69 ("Mark all read" cleared the count).

**Preconditions:** In the Inbox view with at least one unread notification
(use TC-NOTIFY-006).

**Steps:**
1. Open the ··· menu and choose **Mark all read**.

**Expected Result:**
- The "unread" badge disappears and the page shows "0 unread notifications"
- No row or bell dot remains

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-010: At phone width the row actions show without hover (SPM-179)

Origin: Backfilled 2026-10-04 from PR #69 (at 390px wide the actions show
without hover, and the ··· menu sits in the queue header).

**Preconditions:** Signed in as `coordinator@test.com` with at least one
notification; on `/staff/coordinator/notifications`.

**Steps:**
1. DevTools device toolbar at **390** px wide.
2. Look at the notification row without hovering.

**Expected Result:**
- The read/unread and archive buttons are visible at the bottom right of the row
- The ··· menu sits in the queue header above the list

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-011: A switched-off preference stays off after reload (SPM-180)

Origin: Backfilled 2026-10-04 from PR #70 (under `pnpm dev:local`, Preferences
opened the sheet; turning a switch off, reloading and reopening showed it still
off).

Locally, "Coordinator assigned" is not listed (Novu's Development environment
never stores our workflow), so use any other type the sheet lists. If it says
"Nothing to choose yet.", this case cannot be run locally.

**Preconditions:** Signed in as `coordinator@test.com`, on
`/staff/coordinator/notifications`.

**Steps:**
1. Open the ··· menu and choose **Preferences**. The "Notification preferences" sheet opens.
2. Turn off a switch that is not marked "Always on".
3. Reload the page, open **Preferences** again.
4. Turn the switch back on.

**Expected Result:**
- After the reload the switch is still off
- (Step 4 restores the original state)

**Status:** [ ] Pass [ ] Fail

---

### TC-NOTIFY-012: "Coordinator assigned" is always on (SPM-180)

Origin: Backfilled 2026-10-04 from PR #70 (listed unticked, to be checked after
the Production Novu sync; it cannot appear locally).

**Preconditions:** The deployed Production app after the post-deploy Novu sync;
signed in as an Event Coordinator.

**Steps:**
1. Open the inbox, then ··· → **Preferences**.

**Expected Result:**
- "Coordinator assigned" is listed, marked "Always on" with a lock, and its
  switch is disabled

**Status:** [ ] Pass [ ] Fail
