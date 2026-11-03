# Event Request Withdrawal Manual Tests (SPM-101)

## Overview
Manual browser tests for the Event Coordinator recording the withdrawal of an
event request that the Organiser asked for outside the system
([#103](https://github.com/SinYang13/IS212-2026/discussions/103)).

These cases are registered as `TC-WITHDRAW-001`–`TC-WITHDRAW-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack seeded from `supabase/seed.sql`, with migration
  `20260924000000_coordinator_withdraw_event_request.sql` applied
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `organiser@test.com` (Event Organiser)
- `lead@test.com` (Event Coordinator Lead)
- `coordinator@test.com` (Event Coordinator)

### Shared Pre-Conditions
1. As `organiser@test.com`, submit a complete event request.
2. As `lead@test.com`, assign it to Test Coordinator. It is now `Under Review`.

---

## TC-WITHDRAW-001 Coordinator records a withdrawal with a note

**Steps**
1. Log in as `coordinator@test.com` and open the request from "My requests".
2. In the **Withdrawal** card, click **Record withdrawal**.
3. Type `Organiser called to withdraw.` in **Note** and click **Confirm withdrawal**.

**Expected Result**
- [ ] The page shows the badge **Withdrawn**, and the Decision card reads
      "Withdrawn at the Organiser's request" with the note.
- [ ] The request is no longer in "My requests" and is listed in **Archive**.
- [ ] There is no Approve/Reject form or Withdrawal card any more.
- [ ] `audit_record` has a row with `action = 'withdraw'`, `entity_id` = the
      request, and `actor_user_account_id` = Test Coordinator.

**Screenshots:** [step6-withdrawal-confirm-step](../screenshots/2026-09-29_TC-WITHDRAW-001_step6-withdrawal-confirm-step.png) · [step7-withdrawal-coordinator-archive](../screenshots/2026-09-29_TC-WITHDRAW-001_step7-withdrawal-coordinator-archive.png) · [step8-withdrawal-coordinator-queue-after](../screenshots/2026-09-29_TC-WITHDRAW-001_step8-withdrawal-coordinator-queue-after.png) · [step9-withdrawal-under-review-withdrawal-card](../screenshots/2026-09-29_TC-WITHDRAW-001_step9-withdrawal-under-review-withdrawal-card.png) · [step3-confirm-with-note](../screenshots/2026-10-04_TC-WITHDRAW-001_step3-confirm-with-note.png) · [step3b-hung-withdrawing](../screenshots/2026-10-04_TC-WITHDRAW-001_step3b-hung-withdrawing.png) · [step4-after-reload](../screenshots/2026-10-04_TC-WITHDRAW-001_step4-after-reload.png) · [step5-in-archive](../screenshots/2026-10-04_TC-WITHDRAW-001_step5-in-archive.png)

## TC-WITHDRAW-002 Cancel and blank-note withdrawal

**Steps**
1. On a second request that is `Returned` (ask the Organiser a question first
   with **Comment & return**, once SPM-33 is merged) or `Under Review`, click
   **Record withdrawal**, then **Cancel**.
2. Click **Record withdrawal** again, leave **Note** empty and click **Confirm withdrawal**.

**Expected Result**
- [ ] After step 1 the request is unchanged.
- [ ] After step 2 the request is **Withdrawn** and the Note row is empty
      (`decision_record` is null).

**Screenshots:** [step1-cancel-unchanged](../screenshots/2026-10-04_TC-WITHDRAW-002_step1-cancel-unchanged.png) · [step2-after-confirm](../screenshots/2026-10-04_TC-WITHDRAW-002_step2-after-confirm.png)

## TC-WITHDRAW-003 Organiser and Operations see the withdrawal

**Steps**
1. Log in as `organiser@test.com` and open "My requests", then the withdrawn request.
2. Log in as `lead@test.com` and open the event request lists.

**Expected Result**
- [ ] The Organiser sees a grey **Withdrawn** badge, which looks different from
      the red **Rejected** badge.
- [ ] The Organiser has no control to withdraw a request anywhere
      ([#102](https://github.com/SinYang13/IS212-2026/discussions/102)).
- [ ] Operations lists the request under the assigned queue, not the unassigned one.

**Screenshots:** [step3-withdrawal-organiser-my-requests](../screenshots/2026-09-29_TC-WITHDRAW-003_step3-withdrawal-organiser-my-requests.png) · [step4-withdrawal-organiser-withdrawn-detail](../screenshots/2026-09-29_TC-WITHDRAW-003_step4-withdrawal-organiser-withdrawn-detail.png) · [step5-withdrawal-withdrawn-outcome](../screenshots/2026-09-29_TC-WITHDRAW-003_step5-withdrawal-withdrawn-outcome.png) · [step1-organiser-list-badges](../screenshots/2026-10-04_TC-WITHDRAW-003_step1-organiser-list-badges.png) · [step1-organiser-withdrawn-detail](../screenshots/2026-10-04_TC-WITHDRAW-003_step1-organiser-withdrawn-detail.png) · [step2-ops-assigned-list](../screenshots/2026-10-04_TC-WITHDRAW-003_step2-ops-assigned-list.png)
