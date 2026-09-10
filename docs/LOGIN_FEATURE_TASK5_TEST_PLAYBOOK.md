# SPM-13: Login Feature - Task 5 Test Playbook

**Objective:** Verify the login UI works end-to-end with the seed authentication data created in Task 1.

**Scope:** Login page form submission → `LoginUseCase` execution → error handling → success redirect

**Time estimate:** 10–15 minutes

---

## 🎯 Test Setup Prerequisites

### 1. Verify Local Supabase is Running

```bash
# Terminal 1: Check Supabase status
supabase status

# Expected output:
# Supabase API running at http://127.0.0.1:54321
# DB Connection: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# ...
```

**If not running:**
```bash
supabase start
# Wait for output showing service URLs
```

### 2. Verify Test Users Are Seeded

```bash
# Terminal 2: Check auth.users were created
# Visit: http://127.0.0.1:54323
# (Supabase Studio)
# 
# Go to: Authentication > Users
# Expected: 6 test users (organiser@test.com, coordinator@test.com, etc.)
```

**If users missing, re-seed:**
```bash
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="sb_secret_XXXXX" \
pnpm ts-node supabase/seed-auth-test-users.ts
```

Find the `SUPABASE_SERVICE_ROLE_KEY` from the `supabase start` output.

### 3. Start the Next.js Dev Server

```bash
# Terminal 3: Start the app
pnpm dev:local

# Expected output:
# ▲ Next.js 16.3.4
# - ready started server on 0.0.0.0:3000
```

**Verify environment:**
```bash
# Check that NEXT_PUBLIC_SUPABASE_URL is set correctly
echo $NEXT_PUBLIC_SUPABASE_URL
# Should output: http://127.0.0.1:54321 (for local) or your cloud URL
```

---

## 📝 Test Credentials

Use these credentials for testing (from Task 1's seed script):

| Role | Email | Password | Expected |
|------|-------|----------|----------|
| Event Organiser | `organiser@test.com` | `TestPass123!` | ✅ Login success |
| Event Coordinator | `coordinator@test.com` | `TestPass123!` | ✅ Login success |
| Event Operations Manager | `ops@test.com` | `TestPass123!` | ✅ Login success |
| Venue Staff | `venue@test.com` | `TestPass123!` | ✅ Login success |
| Technical Support Staff | `support@test.com` | `TestPass123!` | ✅ Login success |
| Attendee (test invalid login) | `attendee@test.com` | `TestPass123!` | ❌ Should fail (attendees can't log in) |

---

## 🧪 Test Cases

### TC-LOGIN-001: Valid Login — Event Organiser

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `organiser@test.com`
3. Enter password: `TestPass123!`
4. Click "Sign in"

**Expected Result:**
- ✅ No error banner displayed
- ✅ Page redirects to `/staff` (or role dashboard in Task 6)
- ✅ User is authenticated (cookie session created)
- ✅ Browser console shows no errors

**Verification (DevTools):**
```
// In Application > Cookies > localhost:3000
// Look for: sb-<project-id>-auth-token (Supabase session cookie)
// It should be present and contain a JWT
```

---

### TC-LOGIN-002: Valid Login — Coordinator

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `coordinator@test.com`
3. Enter password: `TestPass123!`
4. Click "Sign in"

**Expected Result:**
- ✅ Same as TC-LOGIN-001 (successful redirect)
- ✅ Verify in console: `useCase.execute()` was called with correct email

**Verification:**
Check browser DevTools → Network tab:
- Request to login action should return 200
- Response should redirect (status 307)

---

### TC-LOGIN-003: Invalid Email

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `nonexistent@test.com`
3. Enter password: `TestPass123!`
4. Click "Sign in"

**Expected Result:**
- ✅ Error banner appears: "Invalid credentials"
- ✅ Form remains visible (not redirected)
- ✅ Email and password fields remain filled
- ✅ "Sign in" button is no longer disabled

**Verification (DevTools):**
- Console should show error was caught by Server Action
- No redirect should occur

---

### TC-LOGIN-004: Invalid Password

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `organiser@test.com`
3. Enter password: `WrongPassword123!`
4. Click "Sign in"

**Expected Result:**
- ✅ Same as TC-LOGIN-003: "Invalid credentials" error
- ✅ Form stays visible
- ✅ **Critically:** Error message is generic (does NOT say "password incorrect")
  - This prevents user enumeration attacks

**Security Check:**
Compare error message between TC-LOGIN-003 and TC-LOGIN-004:
- Both should show identical "Invalid credentials" message
- User cannot distinguish between "email doesn't exist" vs "password wrong"

---

### TC-LOGIN-005: Attendee Cannot Log In

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `attendee@test.com`
3. Enter password: `TestPass123!`
4. Click "Sign in"

**Expected Result:**
- ✅ Error banner: "Invalid credentials"
- ✅ User is **not** authenticated (attendee has no role in `user_account_role`)
- ✅ Form remains visible

**Why this works:**
- Task 1 seed creates `attendee@test.com` in `auth.users`
- **But** `attendee@test.com` has NO entry in `user_account_role`
- `SupabaseUserRepository.findByAuthUserId()` returns `null` → no roles
- `LoginUseCase` throws `InvalidCredentialsError` → generic error shown

---

### TC-LOGIN-006: Empty Form Submission

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Leave email and password blank
3. Click "Sign in"

**Expected Result:**
- ✅ HTML5 validation prevents submission (browser-level "required" on inputs)
- ✅ If validation bypassed, Server Action returns "Invalid credentials"

---

### TC-LOGIN-007: SQL Injection Attempt (Security)

**Steps:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `organiser@test.com' OR '1'='1`
3. Enter password: `TestPass123!`
4. Click "Sign in"

**Expected Result:**
- ✅ Error: "Invalid credentials" (no special SQL treatment)
- ✅ Supabase Auth SDK prevents injection (it parameterizes queries)
- ✅ No database errors exposed

---

## 🔄 Full Login Flow Verification

**Step 1: Form Submission**
```
User enters: organiser@test.com / TestPass123!
       ↓
form.tsx calls loginAction() (Server Action)
```

**Step 2: Server Action Execution**
```
loginAction() receives FormData
       ↓
buildLogin() creates LoginUseCase (from composition root)
       ↓
loginUseCase.execute({ email, password })
```

**Step 3: Use Case Orchestration**
```
LoginUseCase:
  1. Calls SupabaseAuthAdapter.login(email, password)
  2. Supabase authenticates, returns user.id
  3. Calls SupabaseUserRepository.findByAuthUserId(user.id)
  4. Repository queries: user_account JOIN user_account_role JOIN role
  5. Returns roles (if any)
  6. Returns LoginResult { userId, roles, expiresAt }
```

**Step 4: Error Handling**
```
On error (InvalidCredentialsError):
  ✅ All exceptions → "Invalid credentials" (generic, no enumeration)
  ✅ Server Action catches & returns LoginState { status: "error", message: "Invalid credentials" }
  ✅ Client receives error → displays banner
```

**Step 5: Success Redirect**
```
On success:
  ✅ Server Action calls redirect("/staff")
  ✅ Next.js handles redirect (throws NEXT_REDIRECT)
  ✅ Client redirects to /staff
  ✅ Session cookie set by Supabase (@supabase/ssr middleware)
```

---

## 🛠️ Testing Checklist

Run through each test case and mark complete:

- [ ] **TC-LOGIN-001:** Event Organiser valid login → redirects
- [ ] **TC-LOGIN-002:** Coordinator valid login → redirects
- [ ] **TC-LOGIN-003:** Invalid email → error banner shown
- [ ] **TC-LOGIN-004:** Invalid password → error banner shown
- [ ] **TC-LOGIN-004 Security:** Error message identical to TC-LOGIN-003 (no enumeration)
- [ ] **TC-LOGIN-005:** Attendee login fails (no roles) → error banner
- [ ] **TC-LOGIN-006:** Empty form → browser validation prevents submission
- [ ] **TC-LOGIN-007:** SQL injection → "Invalid credentials" (safe)

**Bonus checks:**
- [ ] DevTools: Session cookie present after successful login
- [ ] DevTools: No network errors (all requests 200/307)
- [ ] Console: No TypeScript/runtime errors
- [ ] Accessibility: Tab through form, focus outlines visible
- [ ] Mobile: Form responsive on narrow screens (test in DevTools mobile view)

---

## 🐛 Debugging Guide

### **Issue: Login redirects immediately after submit (no error shown)**

**Diagnosis:**
```bash
# Check Supabase is running
supabase status

# Check auth.users were seeded
# Visit: http://127.0.0.1:54323 > Authentication > Users
```

**Fix:**
```bash
# Re-seed if users missing
SUPABASE_SERVICE_ROLE_KEY="sb_secret_XXXXX" pnpm ts-node supabase/seed-auth-test-users.ts
```

---

### **Issue: "Invalid credentials" shown for valid email/password**

**Diagnosis:**
1. Check user exists in `auth.users`:
   ```bash
   supabase status  # Verify Supabase running
   # Visit Studio: http://127.0.0.1:54323 > Authentication > Users
   ```

2. Check user has roles in database:
   ```bash
   # Connect to local Postgres
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
   
   # Query user and roles
   SELECT ua.name, r.role_name
   FROM user_account ua
   JOIN user_account_role uar ON ua.user_account_id = uar.user_account_id
   JOIN role r ON uar.role_id = r.role_id
   WHERE ua.name = 'Test Organiser';
   
   # Expected: Returns 1 row (Test Organiser, Event Organiser)
   ```

3. Check `auth_user_id` is linked:
   ```bash
   SELECT name, auth_user_id FROM user_account WHERE name LIKE 'Test%';
   # Expected: All have non-NULL auth_user_id values
   ```

**Fix:**
- If missing roles: re-seed test data
  ```bash
  supabase db reset
  supabase migration up
  SUPABASE_SERVICE_ROLE_KEY="..." pnpm ts-node supabase/seed-auth-test-users.ts
  ```

---

### **Issue: Error shown as "Invalid credentials" but need more details**

**Diagnosis:**
Enable detailed logging in `/app/auth/login/actions.ts`:

```typescript
// In loginAction, before catch block:
console.log("Login attempt:", { email, password: "***" });

// In catch block:
console.error("Full error:", error);
if (error instanceof InvalidCredentialsError) {
  console.error("Core error (as expected):", error.message);
}
```

**Verification:**
- Server logs (Terminal 3, where `pnpm dev:local` runs) show attempt
- Browser console should show no client-side errors

---

### **Issue: Redirect works but then redirected back to login**

**Cause:** Task 6 (role-based redirect) or middleware not yet implemented.

**Expected behavior (Task 5 only):**
- Redirect to `/staff` (homepage, should exist from earlier work)
- If `/staff` doesn't exist yet, server will 404

**Fix:** Verify `/staff` route exists:
```bash
ls -la src/app/staff/page.tsx
# Should exist and be readable
```

---

## 📊 Manual Testing Workflow

Run this script to test all 5 credentials in sequence:

```bash
#!/bin/bash
# Test all seed credentials in sequence

echo "🔐 Testing ConnectSphere Login Feature"
echo "======================================"

CREDS=(
  "organiser@test.com:TestPass123!"
  "coordinator@test.com:TestPass123!"
  "ops@test.com:TestPass123!"
  "venue@test.com:TestPass123!"
  "support@test.com:TestPass123!"
  "attendee@test.com:TestPass123!"
)

for CRED in "${CREDS[@]}"; do
  EMAIL="${CRED%%:*}"
  PASSWORD="${CRED##*:}"
  
  echo ""
  echo "Testing: $EMAIL"
  echo "---"
  
  # Simulate login via curl (or test in browser manually)
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=$EMAIL&password=$PASSWORD" \
    -L \
    -w "Status: %{http_code}\n" \
    -s > /dev/null
    
  echo "✓ Request completed (check browser for UI result)"
done

echo ""
echo "✅ Manual testing sequence complete"
echo "Check browser DevTools (Network tab) for details"
```

**Run it:**
```bash
chmod +x test-login.sh
./test-login.sh
```

Then in your browser, manually test each credential and verify:
- ✅ Valid staff accounts redirect (5 tests)
- ✅ Attendee shows error (1 test)

---

## ✅ Test Completion Criteria

**All tests pass when:**
1. ✅ All 5 staff credentials log in successfully
2. ✅ Attendee login fails with "Invalid credentials"
3. ✅ Invalid email/password show identical generic error
4. ✅ Session cookie created after successful login
5. ✅ No console errors (TypeScript, runtime, network)
6. ✅ Form is responsive on mobile/desktop
7. ✅ Accessibility: keyboard navigation works (Tab, Enter)

**If any test fails:** Check debugging guide above, fix issue, re-run test.

---

## 📚 Reference

**Related files:**
- Login UI: `src/app/auth/login/page.tsx`, `form.tsx`, `actions.ts`
- Login core: `src/core/use-cases/login.ts`
- Auth adapter: `src/adapters/outbound/supabase/supabase-auth-adapter.ts`
- User repo: `src/adapters/outbound/supabase/supabase-user-repository.ts`
- Test credentials: `supabase/SEED.md`

**Next steps:**
- Task 6: Role-based redirect (Event Organiser → `/staff/organiser/dashboard`, etc.)
- Middleware: Protect `/staff/*` while allowing `/events` public
- Test cases: E2E tests using Playwright/Cypress with test credentials

---

**Test run date:** ____________________  
**Tester:** ____________________  
**Result:** ✅ PASS / ❌ FAIL  
**Notes:** ___________________________________________________________________

