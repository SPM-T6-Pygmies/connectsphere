# Login Feature: Complete Architecture Reference

**Status:** Task 5 Complete (Login UI)  
**Feature:** SPM-13 Login & Authentication  
**Last Updated:** 2026-09-10

---

## 🎯 Background: What Problem Are We Solving?

ConnectSphere is an event planning system with multiple staff roles (Event Organiser, Coordinator, Operations Manager, Venue Staff, Technical Support). The login feature solves:

1. **Authentication Problem:** Staff need to prove they are who they claim to be (email + password)
2. **Authorization Problem:** Different staff roles need access to different dashboards (`/staff/organiser`, `/staff/coordinator`, etc.)
3. **Session Management Problem:** After login, the user must stay logged in across requests
4. **Security Problem:** Generic error messages prevent user enumeration (attacker can't tell if an email exists or password is wrong)

**Key Constraint:** Attendees do NOT need login (public event browsing). Only staff members (5 roles) require authentication.

---

## 📊 Login Flow: Complete Sequence

```
User at Browser                Server (Next.js)              Supabase Auth              Database
    |                               |                            |                         |
    |---> Navigate to /auth/login    |                            |                         |
    |                               |                            |                         |
    |<--- Return login form          |                            |                         |
    |                               |                            |                         |
    |---> Submit: email + password   |                            |                         |
    |                               |                            |                         |
    |                      loginAction (Server Action)           |                         |
    |                               |                            |                         |
    |                      buildLogin() [composition root]       |                         |
    |                               |                            |                         |
    |                      1. SupabaseAuthAdapter.login()        |                         |
    |                               |---> signInWithPassword ---->|                         |
    |                               |<--- Returns: userId, session|                         |
    |                               |                            |                         |
    |                      2. SupabaseUserRepository.findByAuthUserId(userId)             |
    |                               |-------- Query user_account with auth_user_id ------>|
    |                               |<----- Returns: userId, name, roles[] --------------|
    |                               |                            |                         |
    |                      3. LoginUseCase.execute()             |                         |
    |                          Returns: { userId, roles, expiresAt }                      |
    |                               |                            |                         |
    |                      4. On Success: redirect("/")          |                         |
    |<--- Redirect to homepage       |                            |                         |
    |                               |                            |                         |
    |                      5. Session cookie set by middleware   |                         |
    |                               |                            |                         |
    [Authenticated - Can access /staff/* protected routes]
```

**Key Points:**
- Server Action handles auth (never expose secrets to browser)
- Supabase manages password hashing, not our code
- User roles fetched from database after auth confirms identity
- Session cookie persists authentication across requests
- Generic error message shown for any auth failure (security)

---

## 🔧 Mechanism: How Each Component Works

### 1. **Supabase Authentication (Managed Service)**

**What it does:** Supabase handles password hashing, session tokens, and user identity.

**How it works:**
```
User provides: email + password
    ↓
Supabase.auth.signInWithPassword(email, password)
    ↓
Supabase hashes password, compares to stored hash
    ↓
If match: Return { user: { id: UUID }, session: { token, expires_at } }
If no match: Return error
```

**Key:** Supabase doesn't know about ConnectSphere roles. It only authenticates identity. Roles come from our database.

### 2. **User Account + Role Mapping**

**Database schema:**
```sql
-- Supabase manages this table
auth.users (id UUID, email, password_hash, ...)

-- ConnectSphere manages these
user_account (
  user_account_id UUID PRIMARY KEY,
  name VARCHAR,
  auth_user_id UUID REFERENCES auth.users(id)  ← Links to Supabase auth
)

user_account_role (
  user_account_id UUID REFERENCES user_account,
  role_id UUID REFERENCES role
)

role (
  role_id UUID PRIMARY KEY,
  role_name VARCHAR  ← 'Event Organiser', 'Coordinator', etc.
)
```

**Why separate?**
- Supabase `auth.users` = authentication (proves you're you)
- ConnectSphere `user_account` = application identity (who you are in the system)
- `user_account_role` = authorization (what you can access)

### 3. **Ports & Adapters Architecture**

The login feature follows **Hexagonal Architecture** to keep business logic independent of frameworks:

```
src/core/
├── ports/inbound/
│   └── login.ts                    ← Defines what the use case accepts/returns
├── ports/outbound/
│   ├── auth-port.ts                ← Interface for ANY auth provider
│   └── user-repository.ts           ← Interface for ANY user data store
├── use-cases/
│   └── login.ts                    ← CORE LOGIC: orchestrates auth + user lookup
└── domain/
    └── errors.ts                   ← InvalidCredentialsError (generic security)

src/adapters/outbound/supabase/
├── supabase-auth-adapter.ts         ← IMPLEMENTS AuthPort using Supabase SDK
├── supabase-user-repository.ts      ← IMPLEMENTS UserRepository using Supabase SDK
└── client.ts                        ← Supabase SDK clients

src/composition/
└── container.ts                    ← WIRES: LoginUseCase + adapters together

src/app/auth/login/
├── page.tsx                        ← Route handler (loads form)
├── form.tsx                        ← Client form component
└── actions.ts                      ← Server Action that calls buildLogin()
```

**Benefit:** Core logic (login.ts) imports ONLY ports, not Supabase SDK. This means:
- ✅ Core logic is testable without Supabase (mock adapters)
- ✅ Easy to swap auth providers (Cognito, Auth0, etc.) by implementing AuthPort
- ✅ Framework changes don't affect business logic

---

## 🌐 Local vs Cloud Supabase

### **Local Supabase (for development)**

**What it is:** Full Supabase stack running in Docker on your machine.

**Components:**
- PostgreSQL database (`:54322`)
- Supabase API server (`:54321`)
- Supabase Studio UI (`:54323`) ← Where you manage data

**How to start:**
```bash
supabase start
```

**Output shows:**
```
Project URL    │ http://127.0.0.1:54321              ← API endpoint
Publishable    │ sb_publishable_ACJWlzQHl...         ← Anon key
Secret         │ sb_secret_N7UND0UgjKTV...           ← Service role key
```

**Characteristics:**
- Isolated to your machine (no network access)
- Data doesn't persist between `supabase stop/start`
- Keys regenerated each session (different every time)
- Perfect for safe testing without affecting production
- Migrations run locally first before cloud

### **Cloud Supabase (production)**

**What it is:** Supabase-managed PostgreSQL + auth in the cloud.

**Access:** Your Supabase dashboard (dashboard.supabase.com)

**Characteristics:**
- Data persists across sessions
- Keys are permanent (stored in project settings)
- Shared across team members
- Requires `.env` secrets management (Infisical)
- RLS policies enforce security

**In ConnectSphere context:**
```bash
pnpm dev        # Uses cloud Supabase (via .env.local)
pnpm dev:remote # Explicitly connects to cloud via Infisical
```

---

## 📦 pnpm Commands Explained

### `pnpm dev`

**What it does:** Start Next.js dev server using `.env.local`

**Environment source:** Local file (no network calls)

**Use case:** 
- Testing against local Supabase (fastest, safest)
- Testing against cloud Supabase (if keys manually added to .env.local)

**Example:**
```bash
supabase start                    # Terminal 1: Start local Supabase
pnpm dev                          # Terminal 2: Start Next.js dev server
# App connects to http://127.0.0.1:54321 (local Supabase)
```

### `pnpm dev:local`

**What it does:** Start local Supabase AND Next.js dev server via Infisical

**Environment source:** Infisical (fetches from cloud secrets manager)

**Use case:**
- Team testing (pulls latest secrets from Infisical)
- Simulating production environment locally
- Verifying Infisical integration works

**Command breakdown:**
```bash
pnpm dev:local
  ↓
supabase start && infisical run --env=dev -- pnpm dev
  ↓
1. supabase start                    (Start local DB)
2. infisical run --env=dev           (Fetch 'dev' environment secrets)
3. pnpm dev (with those secrets)     (Start app with Infisical vars)
```

**Why you hit the Infisical error:**
```
You are not a member of this project with ID 9e05048e-0b65-4239-9eea-7d5d1c80b926
```

This means: Your Infisical account doesn't have access to the project's `dev` environment secrets. This is a **team permissions issue**, not a code issue.

### `pnpm dev:remote`

**What it does:** Start Next.js dev server against cloud Supabase (production)

**Environment source:** Infisical `prod` environment

**Use case:**
- Testing against live database before deploying
- Debugging production issues
- Team integration testing

**⚠️ Warning:** This connects to real data. Be careful!

---

## 🔐 Infisical: Secrets Management

### What is Infisical?

Cloud secrets manager (similar to AWS Secrets Manager, HashiCorp Vault). Stores sensitive values (API keys, database URLs) securely.

**Why use it?**
```
❌ BAD:  Commit .env.local with secrets to Git
✅ GOOD: Infisical stores secrets, pnpm dev:local fetches them
```

### How it fits into login feature

```
Login requires:
1. NEXT_PUBLIC_SUPABASE_URL        ← Which Supabase to talk to
2. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  ← Public anon key
3. SUPABASE_SERVICE_ROLE_KEY       ← Secret admin key (for server operations)

Where these come from:

pnpm dev:
  → Uses .env.local (manual file)
  
pnpm dev:local / pnpm dev:remote:
  → Uses Infisical (team secrets)
  → Requires: Infisical login + project membership
```

### Role in local vs cloud

| Scenario | Infisical Used? | Workaround |
|----------|---|---|
| Local dev, local Supabase | ❌ No | `pnpm dev` + manual `.env.local` |
| Local dev, cloud Supabase | ⚠️ Optional | `pnpm dev` + `.env.local` with cloud keys |
| Team dev, local Supabase | ⚠️ Optional | `pnpm dev:local` (but has permission issues) |
| Production | ✅ Required | `pnpm dev:remote` (through Infisical) |

**Current state:** You're hitting Infisical permissions on `pnpm dev:local`. **Solution:** Use `pnpm dev` instead (you've done this correctly).

---

## 🏗️ Complete Architecture Breakdown

### Component Map: Who Calls What

```
HTTP Request
    ↓
Next.js Route Handler
    ├─ GET /auth/login
    │   └─→ src/app/auth/login/page.tsx
    │       ├─ Returns: <LoginForm/>
    │       └─→ src/app/auth/login/form.tsx (Client Component)
    │           ├─ Form UI: email, password inputs
    │           └─ On Submit: POST to loginAction
    │
    └─ POST /auth/login (Server Action)
        └─→ src/app/auth/login/actions.ts: loginAction()
            ├─ 1️⃣ buildLogin()  [composition root]
            │   └─→ src/composition/container.ts
            │       ├─ Creates: LoginUseCase
            │       ├─ Injects: SupabaseAuthAdapter
            │       └─ Injects: SupabaseUserRepository
            │
            ├─ 2️⃣ loginUseCase.execute(email, password)
            │   └─→ src/core/use-cases/login.ts
            │       ├─ Calls: authAdapter.login(email, password)
            │       │   └─→ src/adapters/outbound/supabase/supabase-auth-adapter.ts
            │       │       ├─ Creates: createSupabaseAdminClient()
            │       │       └─ Calls: client.auth.signInWithPassword()
            │       │           └─→ Supabase Auth Service
            │       │               ├─ Hashes password
            │       │               ├─ Compares to stored hash
            │       │               └─ Returns: { user.id, session.token }
            │       │
            │       └─ Calls: userRepository.findByAuthUserId(userId)
            │           └─→ src/adapters/outbound/supabase/supabase-user-repository.ts
            │               ├─ Creates: createSupabaseAdminClient()
            │               └─ Queries: SELECT user_account, role FROM...
            │                   WHERE auth_user_id = ?
            │                   └─→ Supabase Database
            │                       └─ Returns: { userId, name, roles[] }
            │
            ├─ 3️⃣ On Success:
            │   ├─ redirect("/")  (Next.js redirect)
            │   └─ Session cookie set by @supabase/ssr middleware
            │
            └─ 4️⃣ On Error:
                ├─ Catch all exceptions
                ├─ Return: { status: "error", message: "Invalid credentials" }
                └─ Form redisplays with error banner
```

### Key Files and Their Roles

| File | Type | Purpose | Key Code |
|------|------|---------|----------|
| `src/app/auth/login/page.tsx` | Route | Metadata (title, description) | `export const metadata = { title: "Login" }` |
| `src/app/auth/login/form.tsx` | Client Component | Email/password inputs, error display | `useActionState(loginAction)` |
| `src/app/auth/login/actions.ts` | Server Action | Calls LoginUseCase, handles redirect | `await login.execute({ email, password })` |
| `src/core/use-cases/login.ts` | Business Logic | Orchestrates: auth → fetch roles → return result | Imports ONLY ports (interfaces) |
| `src/core/ports/inbound/login.ts` | Interface | Defines LoginCommand, LoginResult types | `interface Login { execute(...) }` |
| `src/core/ports/outbound/auth-port.ts` | Interface | Defines what auth providers must implement | `interface AuthPort { login(...) }` |
| `src/core/ports/outbound/user-repository.ts` | Interface | Defines user data access contract | `interface UserRepository { findByAuthUserId(...) }` |
| `src/adapters/outbound/supabase/supabase-auth-adapter.ts` | Adapter | Implements AuthPort using Supabase SDK | `class SupabaseAuthAdapter implements AuthPort` |
| `src/adapters/outbound/supabase/supabase-user-repository.ts` | Adapter | Implements UserRepository using Supabase SDK | `class SupabaseUserRepository implements UserRepository` |
| `src/adapters/outbound/supabase/client.ts` | SDK Wrapper | Creates Supabase clients (admin + session) | `createSupabaseAdminClient()`, `createSupabaseServerClient()` |
| `src/composition/container.ts` | Wiring | ONLY place that imports core + adapters | `export async function buildLogin()` |
| `.env.local` | Config | Local environment variables | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

### Data Flow: Request to Response

```
POST /auth/login { email, password }
    ↓ (Server Action)
src/app/auth/login/actions.ts:loginAction()
    ↓
buildLogin() → returns LoginUseCase wired to adapters
    ↓
loginUseCase.execute({ email, password })
    ├─ authAdapter.login()
    │   └─ Supabase Auth returns: { userId, session }
    ├─ userRepository.findByAuthUserId(userId)
    │   └─ Database returns: { userId, name, roles[] }
    └─ Return: LoginResult { userId, roles, expiresAt }
    ↓
redirect("/")  ← Browser redirects to homepage
    ↓
@supabase/ssr middleware sets session cookie
    ↓
User authenticated (can access /staff/* routes)
```

---

## 🎯 Constraints & How We Circumvent Them

### Constraint 1: RLS (Row-Level Security) on `user_account`

**The Problem:**
```
Supabase enables RLS by default for security.
RLS blocks all database access unless policies are defined.
Publishable Key (browser key) can't bypass RLS.
LoginUseCase needs to query user_account, but Publishable Key can't read it.
```

**Error we got:**
```
'Cannot coerce the result to a single JSON object'
(Means: RLS policy blocked the read, returned 0 rows)
```

**Solution: Use Service Role Key for server operations**
```
createSupabaseAdminClient()
  └─ Uses SUPABASE_SERVICE_ROLE_KEY (server-side secret)
  └─ Bypasses RLS (trusted server context)
  └─ Can read/write any data
```

**Why this is safe:**
- Service Role Key NEVER leaves the server (no env var leaks to browser)
- Only used in Server Actions (server-only code)
- RLS still protects browser clients (they use Publishable Key)

**Scope:**
| Context | Impact |
|---------|--------|
| `pnpm dev` (local Supabase) | ✅ Works with Service Role Key |
| `pnpm dev` (cloud Supabase) | ✅ Works with Service Role Key |
| Production | ✅ Same pattern, different keys |

### Constraint 2: Session Management in Server Actions

**The Problem:**
```
Browser clients use Supabase's automatic session cookie management.
Server Actions don't have browser context (no window, document, etc.).
Browser clients can't authenticate (no cookie access).
```

**Solution: Two-tier client approach**
```
1. createSupabaseAdminClient()
   └─ For server-side operations that bypass auth/RLS
   └─ Used by: LoginUseCase adapters

2. createSupabaseServerClient()
   └─ For user-scoped queries with session cookie context
   └─ Used by: Middleware, future user-specific endpoints
```

**Why this works:**
- Server Action uses admin client to authenticate user
- Middleware (separate flow) uses server client with cookies
- Session cookie persists auth across requests

**Scope:**
| Operation | Client | Key Type | Context |
|-----------|--------|----------|---------|
| Login (auth) | Admin | Service Role | Server Action |
| Fetch user roles | Admin | Service Role | Server Action |
| Check logged-in status | Server | Publishable | Middleware |

### Constraint 3: Generic Error Messages

**The Problem:**
```
Different errors reveal information:
- "Email not found" → Attacker learns which emails exist
- "Password incorrect" → Attacker knows email is valid
- "User has no roles" → Attacker knows user exists but has no access

This is "user enumeration" attack.
```

**Solution: Map ALL errors to generic "Invalid credentials"**
```typescript
try {
  const result = await login.execute({ email, password });
} catch (error) {
  // Catch InvalidCredentialsError, network errors, parse errors, etc.
  return { status: "error", message: "Invalid credentials" };
}
```

**Coverage:**
```
Auth failed (wrong password)      → "Invalid credentials" ✓
Auth failed (email doesn't exist) → "Invalid credentials" ✓
User has no roles                 → "Invalid credentials" ✓
Database error                    → "Invalid credentials" ✓
Any other exception               → "Invalid credentials" ✓
```

**Scope:** All contexts (local dev, cloud, production)

### Constraint 4: Attendees Can't Log In

**The Problem:**
```
Attendee role exists in database (for event registration).
But attendees should NOT be able to log in (no staff access).
If attendee tries login, what happens?
```

**Solution: Return null from user repository if no roles**
```typescript
// SupabaseUserRepository.findByAuthUserId()
if (data.user_account_role.length === 0) {
  return null;  // No roles = not a staff member
}
```

**How it works:**
```
attendee@test.com tries login:
1. Supabase authenticates ✓ (email + password match)
2. userRepository.findByAuthUserId() queries user_account
3. user_account exists but user_account_role is empty
4. Repository returns null
5. LoginUseCase catches this → throws InvalidCredentialsError
6. User sees: "Invalid credentials"
```

**Why this is better than special error:**
- Attendee can't tell why they failed (security)
- Code doesn't need special "attendee login" logic
- System is extensible (future roles work automatically)

**Scope:** All contexts

---

## 🔌 Technical Jargon Glossary

| Term | Meaning | In Context |
|------|---------|-----------|
| **Ports & Adapters** | Architecture pattern isolating business logic from frameworks | LoginUseCase imports ports, not Supabase SDK |
| **Port** | Interface/contract defining what a component must implement | AuthPort, UserRepository are ports |
| **Adapter** | Implementation of a port using a specific framework | SupabaseAuthAdapter implements AuthPort |
| **RLS** | Row-Level Security - database feature that restricts access | Blocks unauthenticated users from reading user_account |
| **Service Role Key** | Secret key with full database permissions | Used server-side only (never in browser) |
| **Publishable Key** | Limited key for browsers, respects RLS | Used by frontend, can't bypass security |
| **Server Action** | Next.js feature for server-side form handling | loginAction runs on server, has access to secrets |
| **Client Component** | React component that runs in browser | LoginForm handles UI, calls Server Action for auth |
| **Middleware** | Code that runs on every request (server-side) | @supabase/ssr middleware manages session cookies |
| **Composition Root** | Single place wiring dependencies together | src/composition/container.ts |
| **Dependency Injection** | Providing dependencies to code instead of hard-coding them | LoginUseCase receives AuthPort + UserRepository |

---

## 📋 Summary: What We Have

### Completed (Task 5)

✅ **Login UI** (`src/app/auth/login/`)
- Form with email, password inputs
- Error banner (generic message)
- Server action handling submission
- Redirect to homepage on success

✅ **Authentication Flow** (Supabase Auth)
- User password hashing
- Session token generation
- Session cookie management

✅ **Role-Based Access** (Database Queries)
- Fetch user roles after successful auth
- Return to client for redirect decision (Task 6)
- Prevent login if user has no roles (Attendee case)

✅ **Security**
- Generic error messages (no user enumeration)
- Service Role Key for server operations (bypasses RLS safely)
- No secrets in browser

✅ **Architecture**
- Ports & Adapters (core independent of frameworks)
- Dependency injection (easy to test, swap providers)
- Single responsibility (auth, repository, UI separated)

### Remaining Tasks

⏳ **Task 6:** Role-based redirect
- After login, redirect to `/staff/[role]/dashboard`
- Map roles to correct dashboard URL

⏳ **Middleware:** Route protection
- Protect `/staff/*` (redirect to `/auth/login` if not authenticated)
- Allow `/events` public (no auth required)
- Allow `/auth/login` public (unauthenticated)

⏳ **Tests:** Verification
- E2E tests with real Supabase
- Manual testing via playbook

---

## 🚀 Next Steps for Team Members

### To Test Login Locally

```bash
# Terminal 1: Start Supabase
supabase start
# Copy the output keys to .env.local

# Terminal 2: Start Next.js
pnpm dev

# Navigate to login
http://localhost:3000/auth/login

# Test with seed credentials
organiser@test.com / TestPass123!
coordinator@test.com / TestPass123!
ops@test.com / TestPass123!
venue@test.com / TestPass123!
support@test.com / TestPass123!
```

### To Understand the Code

1. **Start here:** `src/core/use-cases/login.ts` (business logic)
2. **Then check:** `src/adapters/outbound/supabase/` (how Supabase is used)
3. **Then see:** `src/composition/container.ts` (how pieces wire together)
4. **Finally view:** `src/app/auth/login/` (UI + Server Action)

### To Extend/Modify

- **Change auth provider?** Implement new adapter, same AuthPort interface
- **Change error message?** Update `src/core/domain/errors.ts`
- **Add new user data?** Extend UserRepository interface
- **Change redirect logic?** Update loginAction, then Task 6

---

## 📚 References

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Next.js Server Actions:** https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- **Hexagonal Architecture:** https://www.brandolini.net/2009/03/11/11-tips-on-domain-driven-design/
- **Test Playbook:** `docs/LOGIN_FEATURE_TASK5_TEST_PLAYBOOK.md`
- **Database Setup:** `docs/SEED.md`
- **Project Architecture:** `docs/ARCHITECTURE.md`

---

## 🎓 Conclusion

The login feature is a complete authentication system that:
1. ✅ Proves user identity (Supabase Auth)
2. ✅ Loads user roles (database query)
3. ✅ Creates session (cookie)
4. ✅ Prevents enumeration (generic errors)
5. ✅ Follows architecture (Ports & Adapters)
6. ✅ Works locally and cloud (same code, different keys)

The key insight: **Separate authentication (proving identity) from authorization (checking permissions).** Supabase handles the first, our database handles the second, and the use case orchestrates both.

All decisions we made (RLS, Service Role Key, generic errors) were driven by security + testability + extensibility. Future team members can swap Supabase for another provider by implementing the AuthPort interface—the LoginUseCase won't change.
