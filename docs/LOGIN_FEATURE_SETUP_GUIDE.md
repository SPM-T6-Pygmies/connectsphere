# Login Feature (SPM-13): Detailed Setup Guide

**For:** Team members setting up the login feature for local development  
**Covers:** Local Supabase, test data seeding, pnpm commands, Infisical setup

---

## Prerequisites

```bash
# 1. Node.js (>= 22.12 or >= 20.19)
node --version

# 2. Docker (for local Supabase)
docker --version
# OR Colima (if on Mac)
colima --version

# 3. Supabase CLI
supabase --version
# If not installed: brew install supabase/tap/supabase

# 4. pnpm (package manager)
pnpm --version

# 5. Git
git --version
```

**Colima users:** See [docs/DATABASE.md#troubleshooting-colima](DATABASE.md#troubleshooting-colima) — start with `colima start --memory 4`.

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd connectsphere
pnpm install
```

### 2. Start Local Supabase

```bash
# Terminal 1
supabase start
```

**Output includes credentials like:**
```
Project URL    │ http://127.0.0.1:54321
Publishable    │ sb_publishable_<random-key>
Secret         │ sb_secret_<random-key>
```

**Save these** — you'll need them in the next steps.

### 3. Run Migrations

```bash
# Terminal 2
supabase migration up
```

This creates the database schema, including:
- `auth_user_id` column on `user_account` table
- Test staff accounts (organiser, coordinator, ops, venue, support)
- User-role relationships

**Verify:** Visit http://127.0.0.1:54323 (Supabase Studio)  
Go to **Tables** → **user_account** → Should see 5 test accounts

### 4. Seed Test Users (Auth)

```bash
# Terminal 2 (or new terminal)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="<secret-from-step-2>" \
pnpm ts-node supabase/seed-auth-test-users.ts
```

Replace `<secret-from-step-2>` with the Service Role Key value from Step 2.

**Output should show all 5 staff roles with credentials.**

**Verify:** Supabase Studio → **Authentication** → **Users**  
Should see 5 test users (organiser@test.com, coordinator@test.com, etc.)

### 5. Create `.env.local`

```bash
# Terminal (any)
cp .env.example .env.local
```

Edit `.env.local` and add Supabase values from Step 2:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key-from-step-2>
SUPABASE_SERVICE_ROLE_KEY=<secret-key-from-step-2>
```

(These local defaults are in [docs/DATABASE.md](DATABASE.md#local-envlocal-values) — safe to commit)

### 6. Start Dev Server

```bash
# Terminal 3
pnpm dev
```

**Verify:** Navigate to http://localhost:3000 → Should load

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
pnpm dev              # Dev server (standard, uses .env.local)
```

### Testing

```bash
pnpm test             # Run all tests (190 total)
pnpm test login       # Run only login tests (8 tests)
pnpm test:watch       # Tests in watch mode (re-run on change)
```

### Validation

```bash
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint + architecture boundary checking
pnpm build            # Production build
```

---

## Advanced: Infisical Setup (Optional / Team)

**Use Infisical when:**
- Team wants centralized shared secrets (not individual .env.local files)
- Using cloud Supabase with `pnpm dev:remote`
- Setting up CI/CD integration

**Standard local development** uses `.env.local` (Steps 1-6 above). Infisical is optional.

### Install Infisical

```bash
# macOS
brew install infisical/get-cli/infisical

# OR via pnpm
pnpm add -g @infisical/cli

# Verify
infisical --version
```

### Authenticate (One-Time)

```bash
infisical login
# When prompted: Choose "US Cloud"
```

### Link to Project

```bash
# In project root
infisical init
# Follow prompts to link to your team's Infisical workspace
```

### Use Infisical Commands

```bash
# Dev server with Infisical env vars (local Supabase)
pnpm dev:local
# Equivalent to: supabase start && infisical run --env=dev -- pnpm dev

# Cloud Supabase with Infisical env vars (production)
pnpm dev:remote
# Equivalent to: infisical run --env=prod -- pnpm dev
```

**Note:** If Infisical access fails, ask your team lead for project membership. You can still use `.env.local` for local Supabase testing.

---

## Troubleshooting

### "Cannot find module 'react-day-picker'"
```bash
pnpm install
```

### "Supabase connection refused"
- Ensure Terminal 1: `supabase start` is running
- Check http://127.0.0.1:54323 loads (Supabase Studio)

### "Invalid credentials" on every login attempt
1. Check service role key matches `supabase start` output
2. Verify test users exist: Supabase Studio → Authentication → Users
3. Re-run seed script if users missing:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
   SUPABASE_SERVICE_ROLE_KEY="<secret-from-supabase-start>" \
   pnpm ts-node supabase/seed-auth-test-users.ts
   ```

### "Port 54321 already in use"
```bash
supabase stop
supabase start
```

### Session cookie not created
1. Check `NEXT_PUBLIC_SUPABASE_URL` in .env.local is correct
2. Check `pnpm dev` running (http://localhost:3000 loads)
3. Not in private/incognito mode?

### Colima won't start
```bash
colima stop
colima start --memory 4
```

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
