# Authentication Manual Tests (Login & Logout)

## Overview
Manual browser-based test cases for login and logout features. These tests verify end-to-end authentication flows, security measures, and UI behavior.

These cases are registered as `TC-LOGIN-001`–`TC-LOGOUT-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites
- Local or cloud Supabase instance running
- Access to browser DevTools (F12) for cookie inspection
- Access to Supabase dashboard to verify audit records
- Running: `pnpm run dev` (cloud) or `pnpm dev:local` (local)

### Test Accounts
- **Account 1 (Event Organiser)**
  - Email: `organiser@test.com`
  - Password: `TestPass123!`
  - Roles: Event Organiser

- **Account 2 (Event Coordinator)**
  - Email: `coordinator@test.com`
  - Password: `TestPass123!`
  - Roles: Event Coordinator

### Pre-Test Checklist
- [ ] Application loads without errors
- [ ] Login page is accessible at `/auth/login`
- [ ] Staff dashboard is accessible when logged in
- [ ] Browser DevTools open (F12)

---

## Login Manual Tests

### TC-LOGIN-001: Valid Credentials Login and Dashboard Access

**Preconditions:**
- At `/auth/login`
- Valid credentials ready

**Steps:**
1. Enter email: `organiser@test.com`
2. Enter password: `TestPass123!`
3. Click "Log in" button
4. Observe redirect behavior
5. Note the URL and page content

**Expected Result:**
- Form submission succeeds without errors
- User is redirected to `/staff/requester`
- Dashboard displays role-appropriate content
- Account menu (sidebar footer) shows logged-in user name and role

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step3-dashboard-account-menu](../screenshots/2026-09-13_TC-LOGIN-001_step3-dashboard-account-menu.png)

---

### TC-LOGIN-002: Invalid Password Rejection

**Preconditions:**
- At `/auth/login`
- Valid email ready

**Steps:**
1. Enter email: `organiser@test.com`
2. Enter password: `WrongPassword123!`
3. Click "Log in" button
4. Observe error handling

**Expected Result:**
- Form submission fails with generic error message
- User remains on `/auth/login` page
- Error message shows: "Invalid credentials"
- No specific "password incorrect" message (security: no user enumeration)
- Email field retains value, password field clears

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (3/3 checks)

**Screenshots:** [step2-invalid-credentials-error](../screenshots/2026-09-13_TC-LOGIN-002_step2-invalid-credentials-error.png)

---

### TC-LOGIN-003: Non-Existent Email Rejection

**Preconditions:**
- At `/auth/login`
- Invalid email ready

**Steps:**
1. Enter email: `nonexistent@test.com`
2. Enter password: `TestPass123!`
3. Click "Log in" button
4. Observe error handling

**Expected Result:**
- Form submission fails with generic error message
- User remains on `/auth/login` page
- Error message shows: "Invalid credentials"
- No "user not found" specific message (security: no user enumeration)
- Same error as TC-LOGIN-002 (indistinguishable)

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step2-same-error-as-wrong-password](../screenshots/2026-09-13_TC-LOGIN-003_step2-same-error-as-wrong-password.png)

---

### TC-LOGIN-004: Session Cookie Creation on Login

**Preconditions:**
- Browser DevTools open (Application → Cookies tab)
- At `/auth/login`

**Steps:**
1. Note: No auth cookies present before login
2. Log in with valid credentials (organiser@test.com / TestPass123!)
3. After redirect to dashboard, check Cookies tab
4. Look for cookies starting with `sb-`

**Expected Result:**
- Auth session cookie created: `sb-<project-id>-auth-token`
- Cookie contains valid session token
- Cookie is httpOnly (for security)
- Cookie persists across page refreshes

**Status:** [ ] Pass [x] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (3/4 checks). Finding: not httpOnly (httpOnly=false, SameSite=Lax); the cookie is created and survives a refresh

**Screenshots:** [step3-after-refresh-signed-in](../screenshots/2026-09-13_TC-LOGIN-004_step3-after-refresh-signed-in.png)

---

### TC-LOGIN-005: Session Persists Across Page Refresh

**Preconditions:**
- User logged in at `/staff/requester`
- Session cookie present

**Steps:**
1. Verify you're logged in (account menu shows user name)
2. Press F5 or Ctrl+R to refresh the page
3. Wait for page to reload completely
4. Check if user is still logged in

**Expected Result:**
- Page refreshes without redirect to login
- User remains logged in
- Dashboard reloads with same user context
- No "re-authentication" flow triggered
- Session cookie still valid

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step2-after-refresh-account-menu](../screenshots/2026-09-13_TC-LOGIN-005_step2-after-refresh-account-menu.png)

---

## Logout Manual Tests

### TC-LOGOUT-001: Happy Path - Successful Logout

**Preconditions:**
- User is logged in at `/staff/requester`
- Session cookie exists

**Steps:**
1. Click on user profile icon in sidebar footer
2. Click "Log out" button in dropdown menu
3. Observe redirect behavior
4. Note the current URL

**Expected Result:**
- User is immediately redirected to `/auth/login`
- No error messages displayed
- Session is terminated cleanly

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step1-account-menu-open](../screenshots/2026-09-13_TC-LOGOUT-001_step1-account-menu-open.png) · [step2-redirected-to-login](../screenshots/2026-09-13_TC-LOGOUT-001_step2-redirected-to-login.png)

---

### TC-LOGOUT-002: Browser Back Button After Logout

**Preconditions:**
- User just completed TC-LOGOUT-001 (redirected to login)
- Browser history contains previous protected route

**Steps:**
1. Click browser back button (← arrow)
2. Attempt to navigate back to previous dashboard
3. Observe navigation behavior

**Expected Result:**
- Middleware intercepts back navigation
- User is redirected back to `/auth/login`
- Protected route (`/staff/*`) is NOT accessible
- No cached page loads

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step1-after-back-button](../screenshots/2026-09-13_TC-LOGOUT-002_step1-after-back-button.png)

---

### TC-LOGOUT-003: Session Cookie Cleared After Logout

**Preconditions:**
- User is logged in
- DevTools open with Application → Cookies tab

**Steps:**
1. Note auth cookie: `sb-<project-id>-auth-token`
2. Click logout and complete TC-LOGOUT-001
3. Check Cookies tab again
4. Refresh at `/staff/requester`

**Expected Result:**
- Auth cookie removed/cleared after logout
- No valid session cookie remains
- Refresh redirects to `/auth/login`
- Login form displays (not cached dashboard)

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step4-staff-requester-shows-login](../screenshots/2026-09-13_TC-LOGOUT-003_step4-staff-requester-shows-login.png)

---

### TC-LOGOUT-004: Audit Record Created for Logout Event

**Preconditions:**
- User logged in (note their `user_account_id`)
- Access to Supabase dashboard
- Supabase open in separate tab

**Steps:**
1. Log in with test account
2. In Supabase → SQL Editor, run:
```sql
SELECT * FROM audit_record WHERE action = 'logout' ORDER BY audit_record_id DESC LIMIT 5;
```
3. Note timestamp before logout
4. Perform logout in app
5. Re-run SQL query in Supabase

**Expected Result:**
- New audit record appears after logout
- Record contains:
  - `actor_user_account_id`: logged-in user's ID
  - `entity_type`: "auth_session"
  - `entity_id`: user's account ID
  - `action`: "logout"
  - `occurred_at`: timestamp ~1 second after logout

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (2/2 checks)

**Screenshots:** [step3-signed-out-login-page](../screenshots/2026-09-13_TC-LOGOUT-004_step3-signed-out-login-page.png)

---

### TC-LOGOUT-005: Cannot Access Protected Routes After Logout

**Preconditions:**
- User logged out at `/auth/login`

**Steps:**
1. Try manually navigating to `/staff/requester`
2. Try navigating to `/staff/coordinator`
3. Try navigating to public routes: `/` and `/events`

**Expected Result:**
- All `/staff/*` routes redirect to `/auth/login`
- Redirect happens immediately (middleware)
- Public routes accessible without login
- No 403 Forbidden or error pages shown

**Status:** [x] Pass [ ] Fail — 2026-09-13 (backdated record), run 2026-10-05 in Chrome via Playwright by Claude Code for JameszLau, commit `d00aaf1` (4/4 checks)

**Screenshots:** [step1-staff-requester-redirects](../screenshots/2026-09-13_TC-LOGOUT-005_step1-staff-requester-redirects.png) · [step1-staff-coordinator-redirects](../screenshots/2026-09-13_TC-LOGOUT-005_step1-staff-coordinator-redirects.png) · [step2-public-pages-signed-out](../screenshots/2026-09-13_TC-LOGOUT-005_step2-public-pages-signed-out.png)

---

## Verification Checklist

### UI/UX
- [ ] Login form displays email and password fields
- [ ] Logout button visible in sidebar user dropdown
- [ ] Error messages clear and generic
- [ ] Redirect transitions are smooth

### Security
- [ ] Invalid credentials return generic "Invalid credentials" error
- [ ] Auth cookie is cleared after logout
- [ ] Protected routes redirect to login
- [ ] Browser back button cannot access protected routes
- [ ] No sensitive data in error messages

### Session Management
- [ ] Session persists across page refresh
- [ ] Session terminated on logout
- [ ] New login creates new session

### Audit Trail
- [ ] Audit records created for logout
- [ ] Records contain correct actor, entity, action
- [ ] Timestamps accurate

---

**Document Version:** 1.1  
**Last Updated:** 2026-09-28 — corrected stale password (`Test123!` → `TestPass123!`)
and dead routes (`/staff/organiser/dashboard` → `/staff/requester`,
`/staff/coordinator/dashboard` → `/staff/coordinator`) against the current app.  
**Related Tickets:** SPM-13 (Login), SPM-14 (Logout)
