# Equipment Notification Manual Tests

## Overview

Browser checks for two notifications, built together:

- **SPM-64 — Notify technical support of an equipment requirement.** Every
  change the event's assigned coordinator stores to a line -- adding, editing,
  deleting, asking to remove or undoing that -- gives every Technical Support
  Staff member an in-app notification naming the event, its date, the line,
  what changed and whether it leaves anything for them to do. It opens the
  event under Needs review.
- **SPM-65 — Notify the coordinator of the equipment outcome.** When Technical
  Support's decision leaves nothing on the event needing their attention, its
  assigned coordinator gets one notification listing every line: reserved (how
  many, by whom) or unfulfilled (why, and who said so). It opens the event's
  Equipment tab.

Both can be marked read and cannot be switched off.

What these do **not** cover, so is not tested here:

- **Email delivery** — every notification so far is in-app only (SPM-47).
- **Lines put under review by a reschedule** — SPM-54.
- **Releasing a removal-requested line** (SPM-108): releasing the last line that
  needs attention sends this same notice, and is unit-tested under SPM-108.

The rules — what each change says, which changes do not notify, and when an
event is finished — are unit-tested (`finishesReview` and the use cases, tagged
SPM-64 and SPM-65), including editing a line that is still New, a second edit
to a line already under review, a technical-requirements-only edit, a save
that changes nothing, a refused change, and a decision while another line
still waits.
These cases check the same rules end to end, through the real logins, the
`technical_support_staff_ids` and `event_assigned_coordinator_id` functions,
Novu and the inboxes.

These cases are registered as `TC-EQUIPNOTE-001`–`TC-EQUIPNOTE-006` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset, then the SPM-274 seed:
  ```bash
  supabase db reset
  supabase db query --file scripts/seed-equipment-reserve/seed.sql --local
  supabase db query --file scripts/seed-equipment-reserve/verify.sql --local
  ```
  `verify.sql` should show 14 rows, all `ok = true`.
- `pnpm dev:local` with `NOVU_BRIDGE_URL` set to the tunnel URL it prints (see
  README → Notifications). Without it notifications are only logged — the
  `notification` row is still `Sent`, but nothing reaches an inbox.
- Use `http://localhost:3000`, not `127.0.0.1`, so the coordinator event page's
  tabs switch (SPM-285).
- Run the cases in order: each starts where the one before left off.
- To see who was told, the `notification` table:
  ```sql
  select n.recipient_user_account_id, n.trigger_scenario, n.status, n.message_content
    from notification n
   where n.trigger_scenario in ('equipment-needs-attention', 'equipment-decided')
   order by n.notification_id;
  ```

### Test accounts (password `TestPass123!`)

| Account | Role | Account id |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator (*Test Coordinator*), every seeded event's coordinator | 2 |
| `support@test.com` | Technical Support Staff (*Test Support Staff*) | 5 |
| `support2@test.com` | Technical Support Staff (*Test Support Staff 2*) | 10 |

### The seeded events

| Event | Date | Lines (all New, nothing reserved) |
| --- | --- | --- |
| Design Sprint Demo | Fri, 18 Dec 2026 | Presentation laptop 6 · PA speaker 3 |
| Sales Kickoff | Sat, 19 Dec 2026 | Presentation laptop 3 · Wireless microphone 2 |

Owned: Presentation laptop 8, PA speaker 5, Wireless microphone 30, Projector 10.

---

## Test Cases

### TC-EQUIPNOTE-001: Adding a line tells every Technical Support Staff member the event, date and line

SPM-64 AC1, AC5.

**Steps:**
1. Sign in as `coordinator@test.com`, open **My events**, open *Design Sprint Demo* and click the **Equipment** tab.
2. Under **Add equipment**, choose **Projector**, Quantity `2`, and click **Add line**. Run the `notification` query.
3. Sign in as `support@test.com` and open `/staff/technical/notifications`.
4. Do the same as `support2@test.com`.

**Expected Result:**
- Step 2: one `equipment-needs-attention` row each for accounts 5 and 10, both `Sent`; no row for any other account.
- Steps 3–4: each inbox has "Projector requested for Design Sprint Demo", badged **Equipment recorded**, reading "2 requested. Event date: Fri, 18 Dec 2026."

**Evidence:**
- [`TC-EQUIPNOTE-001_step3-support-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-001_step3-support-inbox.png)
- [`TC-EQUIPNOTE-001_step4-support2-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-001_step4-support2-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-EQUIPNOTE-002: The notice opens the event under Needs review, and can be marked read

SPM-64 AC6, AC7.

**Preconditions:** TC-EQUIPNOTE-001 run. Signed in as `support@test.com` on `/staff/technical/notifications`.

**Steps:**
1. Hover the Projector notice and click **Mark as read** (the envelope). Reload.
2. Click the notice.
3. Click **Open event**.

**Expected Result:**
- Step 1: its unread dot goes and the unread count drops by one; after the reload it is still read.
- Step 2: `/staff/technical/notifications/<event id>` — *Design Sprint Demo*'s equipment lines with the rail still on Notifications and an **Open event** button beside its status. **Projector** is marked **New**, with **Reserve 2**.
- Step 3: `/staff/technical/<event id>` — the same lines with the rail on **Needs review** and the trail "Needs review › Design Sprint Demo", and no **Open event** button.

**Evidence:**
- [`TC-EQUIPNOTE-002_step1-marked-read.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-002_step1-marked-read.png)
- [`TC-EQUIPNOTE-002_step2-opened-from-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-002_step2-opened-from-inbox.png)
- [`TC-EQUIPNOTE-002_step3-event-page.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-002_step3-event-page.png)

**Status:** [x] Pass [ ] Fail

---

### TC-EQUIPNOTE-003: Finishing an event tells its coordinator every line's outcome, once

SPM-65 AC1, AC3.

**Preconditions:** TC-EQUIPNOTE-002 run; *Design Sprint Demo* is open as `support@test.com`.

**Steps:**
1. Click **Reserve 6** on **Presentation laptop**, then **Reserve 3** on **PA speaker**. Run the `notification` query.
2. Click **Reserve 2** on **Projector**. Run the query again.
3. Sign in as `coordinator@test.com` and open `/staff/coordinator/notifications`.

**Expected Result:**
- Step 1: no `equipment-decided` row — the projector still needs attention.
- Step 2: one `equipment-decided` row, for account 2 only, `Sent`.
- Step 3: "Equipment reserved for Design Sprint Demo", badged **Equipment decided**, reading "PA speaker: 3 reserved by Test Support Staff. Presentation laptop: 6 reserved by Test Support Staff. Projector: 2 reserved by Test Support Staff. Event date: Fri, 18 Dec 2026."

**Evidence:**
- [`TC-EQUIPNOTE-003_step3-coordinator-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-003_step3-coordinator-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-EQUIPNOTE-004: An unfulfilled line is listed with why and who said so; the notice opens the Equipment tab

SPM-65 AC3, AC5, AC6.

**Preconditions:** TC-EQUIPNOTE-003 run (*Design Sprint Demo*'s 6 laptops leave 2 free on 18 Dec).

**Steps:**
1. Sign in as `support2@test.com` and open *Sales Kickoff*.
2. On **Presentation laptop**, type `only 2 available` and click **Mark unfulfilled**. Then click **Reserve 2** on **Wireless microphone**.
3. Sign in as `coordinator@test.com` and open `/staff/coordinator/notifications`.
4. Mark the Sales Kickoff notice read and reload, then click it.

**Expected Result:**
- Step 3: "Equipment for Sales Kickoff: 1 of 2 lines unfulfilled", reading "Presentation laptop: unfulfilled (only 2 available), marked by Test Support Staff 2. Wireless microphone: 2 reserved by Test Support Staff 2. Event date: Sat, 19 Dec 2026."
- Step 4: still read after the reload; clicking it opens *Sales Kickoff* on its **Equipment** tab, where **Presentation laptop** shows **Unfulfilled** with **Edit** and **Remove**.

**Evidence:**
- [`TC-EQUIPNOTE-004_step3-coordinator-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-004_step3-coordinator-inbox.png)
- [`TC-EQUIPNOTE-004_step4-equipment-tab.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-004_step4-equipment-tab.png)

**Status:** [x] Pass [ ] Fail

---

### TC-EQUIPNOTE-005: Changing a decided line, or asking to remove one, needs re-review

SPM-64 AC2.

**Preconditions:** TC-EQUIPNOTE-004 run; signed in as `coordinator@test.com` on *Sales Kickoff*'s **Equipment** tab.

**Steps:**
1. Click **Edit** on **Presentation laptop**, set the quantity to `2` and click **Save changes**. Run the `notification` query.
2. Edit it again to `1` and save. Run the query.
3. Open *Design Sprint Demo*'s **Equipment** tab, click **Remove** on **Projector**, then **Request removal**. Run the query.
4. Sign in as `support@test.com` and open `/staff/technical/notifications`.

**Expected Result:**
- Steps 1, 2 and 3: each adds two new `equipment-needs-attention` rows, for accounts 5 and 10.
- Step 4: the inbox has:
  - "Presentation laptop changed on Sales Kickoff" — "Now 2 requested, was 3. The earlier decision needs re-review. Event date: Sat, 19 Dec 2026."
  - "Presentation laptop changed on Sales Kickoff" — "Now 1 requested, was 2. The earlier decision needs re-review. Event date: Sat, 19 Dec 2026."
  - "Projector removal requested on Design Sprint Demo" — "The coordinator asked to remove this line. Its reservation needs re-review. Event date: Fri, 18 Dec 2026."

**Evidence:**
- [`TC-EQUIPNOTE-005_step4-support-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-005_step4-support-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-EQUIPNOTE-006: A change that leaves nothing to do is announced too, and says so

SPM-64 AC1, AC2.

**Preconditions:** TC-EQUIPNOTE-005 run; signed in as `coordinator@test.com` on *Design Sprint Demo*'s **Equipment** tab.

**Steps:**
1. Click **Undo removal** on **Projector**. Run the `notification` query.
2. Click **Edit** on **Presentation laptop**, set the quantity to `5` and save. Then edit it back to `6` and save. Run the query.
3. Under **Add equipment**, choose **Wireless microphone**, Quantity `4`, and click **Add line**. Then click **Remove** on it and **Remove line**. Run the query.
4. Sign in as `support@test.com` and open `/staff/technical/notifications`.

**Expected Result:**
- Step 1: two new rows, for accounts 5 and 10.
- Step 2: four new rows — two per save.
- Step 3: four new rows — two for the add, two for the removal.
- Step 4: the inbox has, newest first:
  - "Wireless microphone removed from Design Sprint Demo" — "The coordinator removed this line. Nothing was reserved, so there is nothing to do. Event date: Fri, 18 Dec 2026."
  - "Wireless microphone requested for Design Sprint Demo" — "4 requested. Event date: Fri, 18 Dec 2026."
  - "Presentation laptop changed on Design Sprint Demo" — "Now 6 requested, was 5. That is what was decided, so the earlier decision stands. Event date: Fri, 18 Dec 2026."
  - "Presentation laptop changed on Design Sprint Demo" — "Now 5 requested, was 6. The earlier decision needs re-review. Event date: Fri, 18 Dec 2026."
  - "Projector removal withdrawn on Design Sprint Demo" — "The coordinator is keeping this line. Its reservation stands. Event date: Fri, 18 Dec 2026."

**Evidence:**
- [`TC-EQUIPNOTE-006_step4-support-inbox.png`](../screenshots/2026-10-13_TC-EQUIPNOTE-006_step4-support-inbox.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-13

Run by Claude Code for jerricknsc on branch
`feat/spm-64-65-equipment-notifications`, against `pnpm dev:local` (Next.js
dev mode, Novu Development through a `novu dev` tunnel, `NOVU_BRIDGE_URL` set
in `.env.local`) on a freshly reset and seeded local Supabase, after
`pnpm novu:clear`, in headless Chromium driven by Playwright at 1440 × 900.
No page errors were raised. All 20 `notification` rows ended `Sent`.

| Case | Result | Observed |
| --- | --- | --- |
| TC-EQUIPNOTE-001 | Pass | One `Sent` row each for accounts 5 and 10, no others. Both inboxes show "Projector requested for Design Sprint Demo", badged Equipment recorded, "2 requested. Event date: Fri, 20 Nov 2026." |
| TC-EQUIPNOTE-002 | Pass | Mark as read cleared the unread dot and it stayed read after a reload. Clicking the notice opened `/staff/technical/notifications/1` with Projector New, Reserve 2, and an Open event button; Open event went to `/staff/technical/1`, rail on Needs review, no button |
| TC-EQUIPNOTE-003 | Pass | No `equipment-decided` row after the laptops and speakers; one for account 2 after the projector. Inbox: "Equipment reserved for Design Sprint Demo", "PA speaker: 3 reserved by Test Support Staff. Presentation laptop: 6 reserved by Test Support Staff. Projector: 2 reserved by Test Support Staff. Event date: Fri, 20 Nov 2026." |
| TC-EQUIPNOTE-004 | Pass | "Equipment for Sales Kickoff: 1 of 2 lines unfulfilled", "Presentation laptop: unfulfilled (only 2 available), marked by Test Support Staff 2. Wireless microphone: 2 reserved by Test Support Staff 2. Event date: Sat, 21 Nov 2026." Still read after reload; opened `/staff/coordinator/events/2?tab=equipment` with the laptop Unfulfilled, Edit and Remove |
| TC-EQUIPNOTE-005 | Pass | Two rows (accounts 5 and 10) after each of steps 1–3. Inbox: "Now 2 requested, was 3." and "Now 1 requested, was 2.", each "The earlier decision needs re-review."; "Projector removal requested on Design Sprint Demo" |
| TC-EQUIPNOTE-006 | Pass | 2, 4 and 4 new rows. Inbox, newest first: Wireless microphone removed ("…nothing to do"), Wireless microphone requested ("4 requested"), Presentation laptop "Now 6 requested, was 5. That is what was decided, so the earlier decision stands.", "Now 5 requested, was 6. The earlier decision needs re-review.", Projector removal withdrawn ("Its reservation stands.") |
