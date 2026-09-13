# Authentication Manual Tests (Login & Logout)

## Overview
Manual browser-based test cases for login and logout features. These tests verify end-to-end authentication flows, security measures, and UI behavior.

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
  - Password: `Test123!`
  - Roles: Event Organiser

- **Account 2 (Event Coordinator)**
  - Email: `coordinator@test.com`
  - Password: `Test123!`
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
2. Enter password: `Test123!`
3. Click "Log in" button
4. Observe redirect behavior
5. Note the URL and page content

**Expected Result:**
- Form submission succeeds without errors
- User is redirected to `/staff/organiser/dashboard`
- Dashboard displays role-appropriate content
- RoleSwitcher shows logged-in user name and role

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

---

### TC-LOGIN-003: Non-Existent Email Rejection

**Preconditions:**
- At `/auth/login`
- Invalid email ready

**Steps:**
1. Enter email: `nonexistent@test.com`
2. Enter password: `Test123!`
3. Click "Log in" button
4. Observe error handling

**Expected Result:**
- Form submission fails with generic error message
- User remains on `/auth/login` page
- Error message shows: "Invalid credentials"
- No "user not found" specific message (security: no user enumeration)
- Same error as TC-LOGIN-002 (indistinguishable)

**Status:** [ ] Pass [ ] Fail

---

### TC-LOGIN-004: Session Cookie Creation on Login

**Preconditions:**
- Browser DevTools open (Application → Cookies tab)
- At `/auth/login`

**Steps:**
1. Note: No auth cookies present before login
2. Log in with valid credentials (organiser@test.com / Test123!)
3. After redirect to dashboard, check Cookies tab
4. Look for cookies starting with `sb-`

**Expected Result:**
- Auth session cookie created: `sb-<project-id>-auth-token`
- Cookie contains valid session token
- Cookie is httpOnly (for security)
- Cookie persists across page refreshes

**Status:** [ ] Pass [ ] Fail

---

### TC-LOGIN-005: Session Persists Across Page Refresh

**Preconditions:**
- User logged in at `/staff/organiser/dashboard`
- Session cookie present

**Steps:**
1. Verify you're logged in (RoleSwitcher shows user name)
2. Press F5 or Ctrl+R to refresh the page
3. Wait for page to reload completely
4. Check if user is still logged in

**Expected Result:**
- Page refreshes without redirect to login
- User remains logged in
- Dashboard reloads with same user context
- No "re-authentication" flow triggered
- Session cookie still valid

**Status:** [ ] Pass [ ] Fail

---

## Logout Manual Tests

### TC-LOGOUT-001: Happy Path - Successful Logout

**Preconditions:**
- User is logged in at `/staff/organiser/dashboard`
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

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

---

### TC-LOGOUT-003: Session Cookie Cleared After Logout

**Preconditions:**
- User is logged in
- DevTools open with Application → Cookies tab

**Steps:**
1. Note auth cookie: `sb-<project-id>-auth-token`
2. Click logout and complete TC-LOGOUT-001
3. Check Cookies tab again
4. Refresh at `/staff/organiser/dashboard`

**Expected Result:**
- Auth cookie removed/cleared after logout
- No valid session cookie remains
- Refresh redirects to `/auth/login`
- Login form displays (not cached dashboard)

**Status:** [ ] Pass [ ] Fail

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

**Status:** [ ] Pass [ ] Fail

---

### TC-LOGOUT-005: Cannot Access Protected Routes After Logout

**Preconditions:**
- User logged out at `/auth/login`

**Steps:**
1. Try manually navigating to `/staff/organiser/dashboard`
2. Try navigating to `/staff/coordinator/dashboard`
3. Try navigating to public routes: `/` and `/events`

**Expected Result:**
- All `/staff/*` routes redirect to `/auth/login`
- Redirect happens immediately (middleware)
- Public routes accessible without login
- No 403 Forbidden or error pages shown

**Status:** [ ] Pass [ ] Fail

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

**Document Version:** 1.0  
**Last Updated:** 2026-09-13  
**Related Tickets:** SPM-13 (Login), SPM-14 (Logout)
