# Access-Denied Manual Tests (SPM-16)

## Overview

Browser checks for the shared access-denied screen shown on any `/staff/*`
page a signed-in user may not open. They cover what the unit tests cannot: that
each page really shows the screen with a 403, that it gives nothing away about
whether a record exists, and that it works at mobile width.

The rules behind the screen are unit-tested (tagged `SPM-16`): which role each
page area names (`pageAreaOwner`) and where the link goes (`homeWorkspaceFor`).

These cases are registered as `TC-DENY-001`–`TC-DENY-008` in
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
- Browser DevTools open on the **Network** tab (to read the HTTP status)

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Own workspace |
| --- | --- | --- |
| `organiser@test.com` | Event Organiser | `/staff/requester` |
| `coordinator@test.com` | Event Coordinator | `/staff/coordinator` |
| `lead@test.com` | Event Coordinator Lead | `/staff/lead` |
| `venue@test.com` | Venue Staff | `/staff/venue` |
| `support@test.com` | Technical Support Staff | `/staff/technical` |

### Finding a request ID that exists but isn't the coordinator's

Every sample request is either assigned to Test Coordinator or to nobody, so an
unassigned one is "someone else's" from the coordinator's point of view:

```sql
select event_request_id, event_name, status
  from event_request
 where assigned_coordinator_user_account_id is null
   and status <> 'Draft'
 limit 1;
```

Call its ID `<not-mine>` and its name `<not-mine-name>` below. For a missing ID
use `999999` (check it does not exist).

---

## Test Cases

### TC-DENY-001: Wrong workspace shows the access-denied screen (AC1, AC4)

**Preconditions:** Signed in as each account below in turn.

**Steps:** For each row, open the URL.

| Signed in as | Open | Message must end with |
| --- | --- | --- |
| `venue@test.com` | `/staff/lead` | Please contact your respective Event Coordinator Lead. |
| `lead@test.com` | `/staff/requester` | Please contact your respective Event Organiser. |
| `organiser@test.com` | `/staff/coordinator` | Please contact your respective Event Coordinator. |
| `coordinator@test.com` | `/staff/venue` | Please contact your respective Venue Staff. |
| `venue@test.com` | `/staff/technical` | Please contact your respective Technical Support Staff. |

**Expected Result:**
- Heading "You don't have access to this page." and the message in the table
- No 404 page, and none of that role's content (no queue, no sidebar)
- Network tab: the document request is **403**
- No person's name appears on the screen, only the role

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-002: A record that isn't theirs shows the access-denied screen (AC2)

**Preconditions:** Signed in as `coordinator@test.com`; `<not-mine>` found as above.

**Steps:**
1. Open `/staff/coordinator/<not-mine>`

**Expected Result:**
- The access-denied screen, naming the Event Coordinator
- Network tab: **403**

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-003: A record that isn't theirs and a missing ID look identical (AC3)

**Preconditions:** As TC-DENY-002.

**Steps:**
1. Open `/staff/coordinator/<not-mine>`. Note the status and the text on the page.
2. Open `/staff/coordinator/999999`. Note the same.
3. On both, view the page source (Ctrl/Cmd+U) and search for `<not-mine-name>`.
4. Repeat 1–3 signed in as `lead@test.com` with `/staff/lead/<draft>` vs
   `/staff/lead/999999`. Operations never sees drafts, so a draft is the record
   that exists but isn't theirs:
   ```sql
   select event_request_id, event_name from event_request where status = 'Draft' limit 1;
   ```

**Expected Result:**
- Same HTTP status (**403**) for both URLs
- Word-for-word the same text on both screens
- `<not-mine-name>` and other request details appear in neither page source

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-004: "Go back to your workspace" opens the user's own workspace (AC5)

**Preconditions:** On any access-denied screen from TC-DENY-001.

**Steps:**
1. Click **Go back to your workspace**

**Expected Result:**
- Lands on the signed-in user's own workspace from the accounts table (e.g.
  `venue@test.com` → `/staff/venue`)
- That page loads normally (200), not another denial

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-005: An Organiser with no client organisation sees a distinct message and is signed out to login (AC5, SPM-188)

**Preconditions:** Local database only. Detach the second Organiser from their
organisation:

```sql
update user_account set client_organisation_id = null where name = 'Test Organiser 2';
```

**Steps:**
1. Sign in as `organiser2@test.com`
2. Open `/staff/requester`
3. Afterwards, put the organisation back:
   ```sql
   update user_account u
      set client_organisation_id = c.client_organisation_id
     from client_organisation c
    where u.name = 'Test Organiser 2' and c.name = 'Test Organisation';
   ```

**Expected Result:**
- Heading reads "Something went wrong." — not "You don't have access to this page."
- Message reads exactly "Please contact your respective Event Coordinator for
  support." — not "...Event Organiser" (this account has no org, so calling
  it an access question and naming the Organiser's own role was circular)
- A **"Back to login"** button is shown — not "Go back to your workspace" and
  not no link at all
- Clicking it signs the account out and lands on `/auth/login` — verify by
  then opening `/staff/requester` directly: it redirects to `/auth/login`
  (signed out), it does **not** show this same access-denied screen again
- Network tab: **403** on the original denied page

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-006: The screen works at mobile and desktop widths (AC6)

**Preconditions:** On any access-denied screen from TC-DENY-001.

**Steps:**
1. DevTools device toolbar at **375 × 667** (iPhone SE)
2. Then at **1280 × 800**

**Expected Result:**
- At 375px: the heading and message wrap and stay readable, the button is full
  width and easy to tap, and there is no horizontal scroll
- At 1280px: the content sits centred in a narrow column and the button fits its
  label

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-007: Login is refused for an account with no staff role (SPM-192)

Attendees are never seeded with an account (they don't get one in the real
product — see [`supabase/SEED.md`](../../supabase/SEED.md)), so this uses a
temporary role swap on an existing test account instead.

**Preconditions:** Local database only.

```sql
-- Give Test Organiser 2 the Attendee role instead of Event Organiser
update user_account_role
   set role_id = (select role_id from role where role_name = 'Attendee')
 where user_account_id = (select user_account_id from user_account where name = 'Test Organiser 2')
   and role_id = (select role_id from role where role_name = 'Event Organiser');
```

**Steps:**
1. Go to `/auth/login`. Enter `organiser2@test.com` / `TestPass123!` and submit.

**Expected Result:**
- Login is refused — you stay on `/auth/login`, never redirected into `/staff`
- Error message: "Authorised users only. For attendees, please visit the
  events page." with "events page" a working link to `/events`
- No session is left behind: opening `/staff/requester` afterwards redirects
  to `/auth/login` (signed out), not to the access-denied screen

**Cleanup:**

```sql
update user_account_role
   set role_id = (select role_id from role where role_name = 'Event Organiser')
 where user_account_id = (select user_account_id from user_account where name = 'Test Organiser 2')
   and role_id = (select role_id from role where role_name = 'Attendee');
```

**Status:** [x] Pass [ ] Fail — 2026-09-28

---

### TC-DENY-008: A session that loses its only staff role still gets the access-denied screen (SPM-192)

The backstop for a session issued before a role change, since login itself
already refuses this account (TC-DENY-007) — a role can still change after
someone is already signed in.

**Preconditions:** Local database only.

**Steps:**
1. Sign in as `organiser2@test.com` / `TestPass123!` normally.
2. Without signing out, in SQL, remove their staff role the same way as
   TC-DENY-007's setup:
   ```sql
   update user_account_role
      set role_id = (select role_id from role where role_name = 'Attendee')
    where user_account_id = (select user_account_id from user_account where name = 'Test Organiser 2')
      and role_id = (select role_id from role where role_name = 'Event Organiser');
   ```
3. In the still-signed-in browser tab, open `/staff/requester`.

**Expected Result:**
- The access-denied screen, not a 404
- Message is exactly "Please contact your respective Event Organiser."
- A **"Back to home"** link is shown, pointing at `/`
- Network tab: **403**

**Cleanup:** Same as TC-DENY-007.

**Status:** [x] Pass [ ] Fail — 2026-09-28
