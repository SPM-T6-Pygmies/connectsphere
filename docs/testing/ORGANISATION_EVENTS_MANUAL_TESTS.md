# Organisation Events Manual Tests (SPM-39)

## Overview

Browser checks for the Event Organiser's **Organisation events** page
(`/staff/requester/organisation`): every event request raised by anyone in the
Organiser's client organisation, and never another organisation's, with an
**Edit** badge only where the Organiser may still edit the request.

Who may see and who may edit (`eventRequestAccessFor`) is unit-tested; these
cases check the page renders that answer for real signed-in Organisers.

These cases are registered as `TC-ORGEV-001`–`TC-ORGEV-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

All four were backfilled on 2026-10-04 from the checks reported in PR #14.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the test accounts and the sample requests:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
- `pnpm dev:local`

### Test Accounts

Password for both: `TestPass123!` (see
[`supabase/SEED.md`](../../supabase/SEED.md)). Both are in **Test
Organisation**.

| Account | Name |
| --- | --- |
| `organiser@test.com` | Test Organiser |
| `organiser2@test.com` | Test Organiser 2 |

### Seeded requests used below

From `scripts/seed-coordinator-view/seed.sql`:

| Request | Raised by | Status |
| --- | --- | --- |
| Founders' Day Celebration | Test Organiser | Draft |
| Winter Volunteer Briefing | Test Organiser | Submitted |
| Annual General Meeting | Test Organiser 2 | Draft |
| Quarterly Partner Forum | Test Organiser 2 | Submitted |

### A request from another organisation (TC-ORGEV-002 only)

The seed has one client organisation, so add a second with one request. Run in
Supabase Studio's SQL editor (http://127.0.0.1:54323):

```sql
with org as (
  insert into public.client_organisation (name)
  values ('TC-ORGEV Other Organisation')
  returning client_organisation_id
)
insert into public.event_request (event_name, status, requesting_user_account_id,
    client_organisation_id)
select 'TC-ORGEV other-org request', 'Submitted', u.user_account_id, org.client_organisation_id
  from org, public.user_account u
 where u.name = 'Test Organiser 2';
```

The request belongs to the new organisation; the requesting account is only
there because the column cannot be empty.

---

## Test Cases

### TC-ORGEV-001: Organisers in the same organisation see each other's requests

Origin: Backfilled 2026-10-04 from PR #14 ("Verified via dev server: same-org
colleagues see each other's requests", against a seeded in-memory repository
with a "Viewing as" switcher).

**Preconditions:** Seeded as above.

**Steps:**
1. Sign in as `organiser@test.com`. In the sidebar, click **Organisation
   events**.
2. Sign out, sign in as `organiser2@test.com` and open **Organisation events**
   again.

**Expected Result:**
- As Test Organiser, the list includes **Quarterly Partner Forum** and
  **Annual General Meeting** with *Submitted by* Test Organiser 2
- As Test Organiser 2, the list includes **Winter Volunteer Briefing** and
  **Founders' Day Celebration** with *Submitted by* Test Organiser
- Each Organiser's own requests are listed too

**Status:** [ ] Pass [ ] Fail

---

### TC-ORGEV-002: Another organisation's requests never appear

Origin: Backfilled 2026-10-04 from PR #14 ("Verified via dev server: ...
never a different org's", against a seeded in-memory repository).

**Preconditions:** Seeded as above, plus the other-organisation request.

**Steps:**
1. Sign in as `organiser@test.com` and open **Organisation events**.
2. Repeat as `organiser2@test.com`.

**Expected Result:**
- **TC-ORGEV other-org request** is in neither list

**Status:** [ ] Pass [ ] Fail

---

### TC-ORGEV-003: Only the responsible Organiser's Draft shows Edit

Origin: Backfilled 2026-10-04 from PR #14 ("Edit only appears for the
responsible Organiser while the request is Draft", against a seeded in-memory
repository).

**Preconditions:** Signed in as `organiser@test.com`; on **Organisation
events**.

**Steps:**
1. Read the **Access** column for **Founders' Day Celebration** (own Draft)
   and **Annual General Meeting** (Test Organiser 2's Draft).

**Expected Result:**
- Founders' Day Celebration shows the **Edit** badge
- Annual General Meeting shows **View only**

**Status:** [ ] Pass [ ] Fail

---

### TC-ORGEV-004: The responsible Organiser's own Submitted request is View only

Origin: Backfilled 2026-10-04 from PR #14 ("including when that Organiser is
the one viewing their own now-Submitted request", against a seeded in-memory
repository).

**Preconditions:** As TC-ORGEV-003.

**Steps:**
1. Read the **Access** column for **Winter Volunteer Briefing** (own,
   Submitted).

**Expected Result:**
- It shows **View only**, not **Edit**

**Status:** [ ] Pass [ ] Fail

---

## Cleanup

```sql
delete from public.event_request where event_name = 'TC-ORGEV other-org request';
delete from public.client_organisation where name = 'TC-ORGEV Other Organisation';
```
