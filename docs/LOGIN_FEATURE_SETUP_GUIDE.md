# Login Feature (SPM-13): Setup Guide

**For:** Team members setting up the login feature for local development  
**Covers:** Local Supabase, Infisical secrets, migrations, seeding, testing

---

## Local Supabase vs Cloud Supabase

### Local Supabase (Your Machine)

Runs entirely on your machine in Docker containers:

```
Your Machine
├── Docker/Colima
│   └── 5 Supabase Containers
│       ├── PostgreSQL database
│       ├── Auth service
│       ├── Storage
│       ├── Functions
│       └── Realtime
└── URL: http://127.0.0.1:54321
```

**Key characteristics:**
- ✅ Only you can access it
- ✅ Auth credentials persist (stored in `.supabase/` directory)
- ✅ Data/state reset on `supabase reset`, but credentials stay same
- ✅ Completely isolated — safe for testing
- ✅ Fast (no network latency)
- ❌ Only exists while containers are running

**Persistence:** As long as `.supabase/` exists, auth credentials remain the same across `supabase stop/start` cycles. Deleting `.supabase/` creates new credentials.

### Cloud Supabase (SPM-212-T6 on Supabase.com)

Hosted project shared with the team:

```
Supabase.com (shared)
└── SPM-212-T6 Project
    ├── PostgreSQL (hosted)
    ├── Auth service (hosted)
    ├── Storage (hosted)
    └── Persistent data
```

**Key characteristics:**
- ✅ Shared with team
- ✅ Persistent data (survives everything)
- ❌ Changes affect entire team
- ❌ Slower (network latency)
- ❌ Never use for personal development

**When to use:** Team integration testing or staging (not this guide).

### Why Local for Development?

1. **Isolation:** Your changes don't affect teammates
2. **Speed:** Instant feedback, no network delays
3. **Safety:** Can reset data without consequences
4. **Autonomy:** Work offline if needed

---

## Prerequisites

**Required:**
```bash
node --version          # >= 22.12 or >= 20.19
docker --version        # OR colima --version (Mac)
supabase --version      # brew install supabase/tap/supabase
pnpm --version          # npm install -g pnpm
git --version
```

**For Infisical (Primary Path):**
```bash
infisical --version     # brew install infisical/get-cli/infisical
```

**Colima users (Mac):** Start with `colima start --memory 4` before proceeding.

---

## Prerequisites

```bash
node --version          # >= 22.12 or >= 20.19
docker --version        # OR colima --version (Mac)
supabase --version      # brew install supabase/tap/supabase
pnpm --version          # npm install -g pnpm
git --version
infisical --version     # brew install infisical/get-cli/infisical
```

**Colima users (Mac):** Start with `colima start --memory 4` before proceeding.

---

## Step 1: Install Dependencies

```bash
cd connectsphere
pnpm install
```

**Expected:** 1-2 minutes, silent completion = success.

---

## Step 2: Start Local Supabase

Open **Terminal 1** and run:

```bash
supabase start
```

**Output:**
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     Anon Key: sb_anon_<random-key>
Service Role Key: sb_secret_<random-key>
     Studio URL: http://127.0.0.1:54323
```

**Save these three values:**
- `API URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `Anon Key` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `Service Role Key` → `SUPABASE_SERVICE_ROLE_KEY`

**Verification:**
- http://127.0.0.1:54323 → Supabase Studio login screen
- Keep this terminal running (don't close it)

**Key point:** As long as you don't delete `.supabase/` directory, these credentials remain the same on future `supabase start` runs.

---

## Step 3: Run Migrations

Open **Terminal 2** and run:

```bash
supabase migration up
```

**What happens:** Creates database schema including:
- `user_account` table with `auth_user_id` column
- `user_account_role` junction table
- Test staff accounts (organiser, coordinator, ops, venue, support)

**Verification:** 
- Supabase Studio → **Tables** tab
- Should see `user_account` with 5 rows

**Caveat:** If migrations fail, see Troubleshooting section.

---

## Step 4: Create Private Infisical Project for Local Secrets

**Why:** Store your local Supabase credentials securely, accessible from any machine.

**Step 4.1: Authenticate Infisical**

```bash
infisical login
```

**Expected:** Browser opens, login with your credentials.

**Output:** `Successfully logged in.`

**Verification:** `infisical whoami` → shows your email.

---

**Step 4.2: Create Private Project**

```bash
infisical project create --name="connectsphere-local" --slug="connectsphere-local"
```

**Output:**
```
Project created: connectsphere-local
```

**Caveat:** Use a slug unique to you (e.g., `connectsphere-local-james`) to avoid conflicts.

---

**Step 4.3: Store Supabase Credentials**

Use Infisical Web UI (easier than CLI):

1. Go to https://app.infisical.com
2. Select your private project (`connectsphere-local`)
3. Click **Secrets** → **dev** environment
4. Add three secrets:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `<Anon Key from Step 2>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<Service Role Key from Step 2>` |

**Verification:** Secrets visible in Infisical UI.

**⚠️ IMPORTANT - Row-Level Security (RLS):**
The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. This is necessary because:
- Server Action needs to lookup `user_account` and `user_account_role` tables
- Browser (Publishable Key) has read-only access, can't see role data (RLS blocks it)
- Server (Service Role Key) has full access, can bypass RLS and fetch all user data
- This is the correct security model: restricted browser, powerful server

---

**Step 4.4: Link Local Project to Infisical**

```bash
cd connectsphere
infisical init
```

**Prompts:**
- "Select Infisical organization" → Your organization
- "Select project" → `connectsphere-local`
- "Select environment" → `dev`

**Output:** `.infisical.json` file created.

**Verification:** `cat .infisical.json` → shows project ID.

---

## Step 5: Seed Authentication Test Users

Create 5 staff test accounts in local Supabase Auth:

```bash
# Terminal 2 (or new terminal)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="<Service-Role-Key-from-Step-2>" \
pnpm ts-node supabase/seed-auth-test-users.ts
```

**Output:**
```
✓ Created staff users:
  - organiser@test.com (password: TestPass123!)
  - coordinator@test.com (password: TestPass123!)
  - ops@test.com (password: TestPass123!)
  - venue@test.com (password: TestPass123!)
  - support@test.com (password: TestPass123!)
```

**Verification:**
- Supabase Studio → **Authentication** tab → **Users**
- Should see 5 test users

---

## Step 6: Run Dev Server with Infisical

```bash
# Terminal 3
pnpm dev
```

**What happens:** Pulls secrets from `.env.local` (or Infisical if configured).

**Output:**
```
▲ Next.js 16 started...
- Local: http://localhost:3000
```

**Verification:** http://localhost:3000 loads.

---

## Step 7: Test Login Feature

### Test 1: Valid Login

1. Open http://localhost:3000/auth/login
2. Email: `organiser@test.com`
3. Password: `TestPass123!`
4. Click "Sign in"

**Expected:**
- ✅ No error
- ✅ Redirects to `/staff/organiser/landing-view`
- ✅ DevTools → Application → Cookies → see `sb-<id>-auth-token`

### Test 2: Invalid Password

1. Email: `organiser@test.com`
2. Password: `WRONG`
3. Click "Sign in"

**Expected:**
- ✅ Error: "Invalid credentials"
- ✅ Stays on `/auth/login`
- ✅ No cookie created

### Test 3: Public Routes (No Auth)

```bash
http://localhost:3000/events     → Loads (public)
http://localhost:3000/           → Loads (public)
```

### Test 4: Protected Routes (Auth Required)

```bash
# Without logging in:
http://localhost:3000/staff/organiser/landing-view
→ Redirects to /auth/login

# After logging in (from Test 1):
http://localhost:3000/staff/organiser/landing-view
→ Landing view loads
```

---

## Managing Your Local Supabase

### Stopping (Preserve Data & Credentials)

```bash
supabase stop
```

**Result:** Containers stop, `.supabase/` remains → credentials persist.

**Next `supabase start`:** Same credentials, same database state.

---

### Resetting Data (Keep Credentials)

```bash
supabase reset
```

**Result:** Database wiped, migrations re-run, credentials unchanged.

**Use when:** You want fresh test data but keep same credentials.

---

### Full Clean Slate (Delete Everything)

```bash
supabase stop
rm -rf .supabase
supabase start
```

**Result:** New `.supabase/` directory created with new credentials.

**Caveat:** You must update Infisical with new credentials.

---

### Reseeding Test Users

```bash
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="<secret-key>" \
pnpm ts-node supabase/seed-auth-test-users.ts
```

**Use when:** Test users accidentally deleted or need fresh state.

---

## Testing Login Feature

### Test Login (Success)

```
1. Go to: http://localhost:3000/auth/login
2. Enter:
   Email: organiser@test.com
   Password: TestPass123!
3. Click "Sign in"

Expected:
  ✅ No error
  ✅ Redirects to /staff/organiser/landing-view
  ✅ Session cookie created (check DevTools → Application → Cookies)
```

### Test Login (Invalid Password)

```
1. Go to: http://localhost:3000/auth/login
2. Enter:
   Email: organiser@test.com
   Password: WRONG
3. Click "Sign in"

Expected:
  ✅ Error banner: "Invalid credentials"
  ✅ Form stays on /auth/login
  ✅ No session cookie
```

### Test Public Routes (No Auth)

```
- http://localhost:3000/events → Should load (public)
- http://localhost:3000/ → Should load (public)
```

### Test Protected Routes (Auth Required)

```
Without logging in:
  http://localhost:3000/staff/organiser/landing-view 
  → Redirects to /auth/login

After logging in:
  http://localhost:3000/staff/organiser/landing-view 
  → Landing view loads
```

---

## pnpm Commands

### Development

```bash
pnpm dev              # Dev server (use after Steps 1-7 are complete)
                      # Pulls secrets from .env.local (or Infisical if set up)
```

### Testing

```bash
pnpm test             # Run all tests (190 total, no database needed)
pnpm test login       # Run only login tests (8 tests, ~5ms)
pnpm test:watch       # Tests in watch mode
```

### Code Quality

```bash
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint + architecture boundaries
pnpm build            # Production build
```

### Supabase Commands

```bash
supabase start        # Start local Supabase (Terminal 1, keep running)
supabase stop         # Stop containers (preserve data & credentials)
supabase reset        # Wipe database, re-run migrations (keep credentials)
supabase migration up # Run pending migrations
```

---

---

## Troubleshooting

### Storage Container Health Issues: "Container is not ready: unhealthy"

**Cause:** Stale Supabase CLI configuration from a previous project or cloud link.

**Symptoms:**
```
supabase_storage_connectsphere container is not ready: unhealthy
```

or

```
Cannot find project ref. Have you run supabase link?
```

**Fix (clean slate):**

```bash
# 1. Stop everything
supabase stop

# 2. Remove global CLI state (from previous projects)
rm -rf ~/.supabase

# 3. Remove project-local state
rm -rf .supabase

# 4. Clean up Docker
docker system prune -f

# 5. Start fresh
supabase start
```

**Why this works:** The global `~/.supabase/` directory stores CLI settings. If you previously used this CLI for a cloud project (SPM-212-T6), stale config gets mixed with local setup. Cleaning both directories forces a fresh local-only initialization.

**After the fix:** `supabase start` should auto-create a new `.supabase/config.toml` configured for local development only.

---

### "Cannot find module 'react-day-picker'"

**Cause:** Missing dependencies.

```bash
pnpm install
```

**If that doesn't work:**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

### "Supabase connection refused"

**Cause:** Supabase containers aren't running or can't reach them.

**Checklist:**
1. Is Terminal 1 still running `supabase start`?
   ```bash
   # Check if Supabase is running
   docker ps | grep supabase
   # Should show ~5 containers
   ```

2. Can you reach Supabase Studio?
   - Open http://127.0.0.1:54323 in browser
   - Should see login prompt
   - If not, containers may be starting — wait 10 seconds and refresh

3. Are Docker containers healthy?
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}" | grep supabase
   # Should show "Up X seconds (healthy)"
   ```

**If containers are down:**
```bash
supabase stop
supabase start
```

---

### "Invalid credentials" on Every Login Attempt

**Cause:** Service Role Key mismatch, or test users weren't created.

**Checklist:**

1. **Verify service role key is correct:**
   - Run `supabase start` in Terminal 1
   - Find the line: `Service Role Key: sb_secret_<key>`
   - Check it matches the `SUPABASE_SERVICE_ROLE_KEY` you used in Step 4

2. **Verify test users exist:**
   - Open Supabase Studio: http://127.0.0.1:54323
   - Login with any email/password
   - Go to **Authentication** tab → **Users**
   - Should see 5 test users: organiser@test.com, coordinator@test.com, etc.

3. **If test users are missing, re-seed:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
   SUPABASE_SERVICE_ROLE_KEY="<secret-from-supabase-start>" \
   pnpm ts-node supabase/seed-auth-test-users.ts
   ```
   Replace `<secret-from-supabase-start>` with the actual key from `supabase start` output.

---

### "Port 54321 Already in Use"

**Cause:** Another process (or old Docker container) is using the port.

```bash
# Stop Supabase
supabase stop

# Give Docker a moment to release ports
sleep 5

# Start again
supabase start
```

If that doesn't work, manually find and kill the process:
```bash
# Find what's using port 54321
lsof -i :54321

# Kill it (replace <PID> with the actual process ID)
kill -9 <PID>

# Try supabase start again
supabase start
```

---

### Session Cookie Not Created After Login

**Symptoms:** You log in successfully (see the login form disappear), but then redirect doesn't happen or cookie isn't saved.

**Checklist:**

1. **Check `.env.local` has correct Supabase URL:**
   ```bash
   cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL
   # Should be: http://127.0.0.1:54321
   ```

2. **Check dev server is running:**
   ```bash
   # Is `pnpm dev` still running in Terminal 3?
   # http://localhost:3000 should load
   ```

3. **Check browser settings:**
   - Not using private/incognito mode? (cookies disabled by default)
   - Open DevTools → Application → Cookies → http://localhost:3000
   - Should see `sb-<id>-auth-token` cookie

4. **If still stuck, restart everything:**
   ```bash
   # Terminal 1
   supabase stop
   supabase start

   # Terminal 3
   # Ctrl+C to stop dev server
   pnpm dev
   ```

---

### Colima Won't Start (Mac Only)

**Cause:** Colima is down or misconfigured.

```bash
# Check status
colima status

# If down, start it
colima start

# If that fails, restart with more memory
colima stop
colima start --memory 4
```

**If Colima keeps crashing:**
```bash
# Check logs
colima logs

# Full restart
colima stop
colima delete
colima start --memory 4
```

See [docs/DATABASE.md#troubleshooting-colima](DATABASE.md#troubleshooting-colima) for more Colima help.

---

## Architecture Overview

### Ports & Adapters (Hexagonal) Architecture

The login feature follows the project's hexagonal architecture:

- **Core (src/core/):** LoginUseCase orchestrates auth and user repository lookup; all errors map to generic InvalidCredentialsError (prevents user enumeration)
- **Ports (src/core/ports/):** AuthPort (login, logout, getSession), UserRepository (findByAuthUserId)
- **Adapters (src/adapters/):** SupabaseAuthAdapter (Supabase Auth), SupabaseUserRepository (user_account table)
- **Composition (src/composition/):** buildLogin() wires use case with adapters
- **Routes (src/app/):** login/page.tsx and login/form.tsx call loginAction Server Action

### Security Features

- **Service Role Key for server operations:** Server Action uses Service Role Key (full permissions) to bypass RLS on user_account table lookups
- **Publishable Key for browser:** Browser receives only Publishable Key (limited read-only), stored in .env.local
- **Session cookies via Supabase middleware:** updateSession() in middleware.ts manages auth state and redirects unauthenticated users from /staff/* to /auth/login
- **Role-based redirects:** LoginUseCase returns user's primary role; loginAction maps to /staff/[role]/landing-view

### Test Data

Five staff roles with test credentials (all use password `TestPass123!`):

| Role | Email | Redirect |
|------|-------|----------|
| Event Organiser | organiser@test.com | /staff/organiser/landing-view |
| Event Coordinator | coordinator@test.com | /staff/coordinator/landing-view |
| Event Operations Manager | ops@test.com | /staff/ops/landing-view |
| Venue Staff | venue@test.com | /staff/venue/landing-view |
| Technical Support Staff | support@test.com | /staff/technical/landing-view |

### Testing Without Supabase

Unit tests for LoginUseCase (src/core/use-cases/login.test.ts) use in-memory test adapters:
- MockAuthAdapter simulates Supabase Auth
- MockUserRepository simulates user_account table
- Tests run in ~5ms without any database or network

```bash
pnpm test login
```

---

## Related Documentation

- **Database setup:** [docs/DATABASE.md](DATABASE.md)
- **Architecture deep dive:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **Seed data info:** [supabase/SEED.md](../supabase/SEED.md)

---

## Next Steps

After setup, you can:
- ✅ Log in with test credentials
- ✅ Test role-based redirects
- ✅ Access protected routes
- ✅ Run `pnpm test` successfully
- ✅ Develop new features

**Questions?** Check the sections above or ask your team lead.
