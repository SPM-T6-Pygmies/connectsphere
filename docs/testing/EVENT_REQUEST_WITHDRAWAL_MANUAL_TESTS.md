# Event Request Withdrawal Manual Tests (SPM-101)

## Overview
Manual browser tests for the Event Coordinator recording the withdrawal of an
event request that the Organiser asked for outside the system
([#103](https://github.com/SinYang13/IS212-2026/discussions/103)).

These cases are registered as `MT-0011`–`MT-0013` in
[`../tests/test-registry.csv`](../tests/test-registry.csv). When you run them,
tick the boxes below **and** set `Status` and `LastPassedDate` on the matching
rows. CI cannot verify a manual case for you.

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack seeded from `supabase/seed.sql`, with migration
  `20260924000000_coordinator_withdraw_event_request.sql` applied
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `organiser@test.com` (Event Organiser)
- `ops@test.com` (Event Operations Manager)
- `coordinator@test.com` (Event Coordinator)

### Shared Pre-Conditions
1. As `organiser@test.com`, submit a complete event request.
2. As `ops@test.com`, assign it to Test Coordinator. It is now `Under Review`.

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

## TC-WITHDRAW-003 Organiser and Operations see the withdrawal

**Steps**
1. Log in as `organiser@test.com` and open "My requests", then the withdrawn request.
2. Log in as `ops@test.com` and open the event request lists.

**Expected Result**
- [ ] The Organiser sees a grey **Withdrawn** badge, which looks different from
      the red **Rejected** badge.
- [ ] The Organiser has no control to withdraw a request anywhere
      ([#102](https://github.com/SinYang13/IS212-2026/discussions/102)).
- [ ] Operations lists the request under the assigned queue, not the unassigned one.
