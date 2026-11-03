# Confirmation on Essential Equipment Manual Tests (SPM-318)

## Overview

Browser checks for **SPM-318: Block confirmation on an unfulfilled essential line**.
On the coordinator's event page, the **Confirmation** card refuses confirmation while
an essential equipment line (marked with SPM-109's **Essential** switch) is not
reserved in full, and lists each such line by type (AC1). A line that is not essential
never blocks, however short it is (AC2). Once every essential line is reserved in full,
equipment no longer blocks, but the other gates (the safety check, SPM-264, and the
essential arrangements, SPM-50) still apply (AC3).

A line is reserved in full when it is **Reserved** with all of its quantity held. A
**Requested** or **Unfulfilled** line is not, and neither is one **Under review**, even
with its units still held: the coordinator has changed it or asked for its removal.

The rules are unit-tested (`isReservedInFull`, `confirmEvent`, `confirmationState`, the
confirm and view use cases and the readiness mapper, all tagged SPM-318), including a
line one unit short, one held exactly, and one under review with its units held.
`coordinator_confirm_event` restates the rule under its row lock. These cases check the
same rule end to end, through the real logins, `event_readiness` and the page.

These cases are registered as `TC-CONFIRM-EQUIP-001`–`TC-CONFIRM-EQUIP-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run them, tick
the boxes below **and** report each in the PR description's `## Manual test results`
table — CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset, then the baseline seeds
  ([scripts/README.md](../../scripts/README.md#1-set-up-your-database)):
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  supabase db query --file scripts/seed-equipment/seed.sql --local
  ```
- `pnpm dev:local`
- Use `http://localhost:3000`, not `127.0.0.1`: Next's dev server blocks its client
  scripts for `127.0.0.1`, so the coordinator event page's tabs do not switch (SPM-285).
- Run the cases in order: each starts where the one before left off.

### Test account (password `TestPass123!`)

| Account | Role | Used for |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | Marking lines and reading the Confirmation card |

### The seeded event

*Founders' Gala Dinner*, Planning, assigned to Test Coordinator, with no safety check
yet and two lines, neither essential: **Projector** 2 (Reserved, 2 held) and
**Wireless microphone** 4 (Requested, nothing held).

---

## Test Cases

### TC-CONFIRM-EQUIP-001: An unreserved essential line blocks confirmation (AC1)

**Steps:**
1. Signed in as `coordinator@test.com`, open **My events**, open *Founders' Gala
   Dinner* and click the **Equipment** tab. Read the **Confirmation** card.
2. Switch **Essential** on for **Wireless microphone**, then reload.

**Expected Result:**
- Step 1: no equipment blocker on the card; only *Cannot confirm -- safety check not
  approved*.
- Step 2: the card adds *Cannot confirm -- 1 essential equipment line not reserved in
  full*, listing **Wireless microphone**. **Confirm event** is disabled.

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-EQUIP-002: A non-essential gap does not block (AC2)

**Preconditions:** TC-CONFIRM-EQUIP-001 passed.

**Steps:**
1. Switch **Essential** off for **Wireless microphone**, then reload.

**Expected Result:**
- The equipment blocker is gone, though Wireless microphone still has nothing
  reserved. Only the safety check blocker remains.

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-EQUIP-003: Essential lines reserved in full do not block, other gates still do (AC3)

**Preconditions:** TC-CONFIRM-EQUIP-002 passed.

**Steps:**
1. Switch **Essential** on for **Projector** (Reserved, 2 of 2), then reload.
2. Switch it off again, to leave the event as seeded.

**Expected Result:**
- Step 1: no equipment blocker. *Cannot confirm -- safety check not approved* is still
  shown and **Confirm event** is still disabled.

**Status:** [ ] Pass [ ] Fail
