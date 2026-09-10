# SPM-13: Login Feature - Task 1 Playbook

## 📋 What This Push Enables

### For the Repository
- ✅ **Supabase Auth Integration:** Connects Supabase's managed authentication (`auth.users`) to ConnectSphere's user model (`user_account`)
- ✅ **Local Development Safety:** Team members can test database migrations and seeding locally before touching cloud
- ✅ **Test Data Automation:** Reproducible test user creation across environments (local dev, CI, cloud)
- ✅ **Foundation for Login Feature:** Database schema and test data ready for building the login page (Tasks 2-7)

### For Your Workflow
- 🔐 **Isolated Local Testing:** `pnpm dev:local` creates a sandbox Supabase instance — safe to break without affecting team
- 📊 **Repeatability:** Same migration + seed script works on local, cloud, and CI pipelines
- 🔄 **Team Collaboration:** Everyone has identical test credentials and data setup
- 🚀 **Risk Mitigation:** Verify migrations locally before deploying to production

---

## 🎯 Core Components & Their Roles

### **1. Database Schema Change**
**File:** `supabase/schema.sql`  
**What it does:** Uncomments `auth_user_id` column on `user_account` table  
**Role in login flow:**
- Bridges Supabase's `auth.users` (password hashing, sessions, JWT) with ConnectSphere's `user_account` (business logic, roles, attributes)
- Foreign key: `auth_user_id uuid references auth.users (id) on delete set null`
- When user logs in, Supabase returns `auth.users.id`, we look it up in `user_account.auth_user_id` to find roles and permissions

**Why it matters:** Without this link, Supabase Auth and your app are disconnected silos.

---

### **2. Migration: Idempotent Schema Setup**
**File:** `supabase/migrations/20260910150000_enable_supabase_auth_and_seed_test_users.sql`  
**What it does:**
- Adds `auth_user_id` column if missing (safe for existing databases)
- Seeds test `user_account` records (one per role)
- Seeds `user_account_role` junction table (multi-role support)

**Idempotent design:**
- Uses `add column if not exists` — safe to run multiple times
- Uses `on conflict do nothing` — inserts skip if data already exists
- Can re-run locally without clearing data

**Role in login flow:**
- Runs once when developer does `supabase migration up`
- Creates test accounts in the database layer
- But doesn't create `auth.users` entries (auth credentials) — that's the seed script's job

**Why separate:** Migrations = schema changes (SQL only). Auth user creation = Supabase Auth service (requires SDK).

---

### **3. Seed Script: Create Supabase Auth Users**
**File:** `supabase/seed-auth-test-users.ts`  
**What it does:**
- Uses Supabase Admin SDK to create `auth.users` entries with email + password
- Links each `auth.users` to the corresponding `user_account` by updating `auth_user_id`
- Runs identically on local and cloud

**Test users created:**
- `organiser@test.com` → Event Organiser role
- `coordinator@test.com` → Event Coordinator role
- `ops@test.com` → Event Operations Manager role
- `venue@test.com` → Venue Staff role
- `support@test.com` → Technical Support Staff role
- `attendee@test.com` → Attendee role (cannot login per business rules)

**Role in login flow:**
- Populates `auth.users` table (Supabase Auth's managed table)
- Makes credentials available for login attempts
- Connects auth.users.id → user_account.auth_user_id (via UPDATE query)

**Why it matters:** Without this, test users exist in database but have no way to authenticate.

---

### **4. Documentation: Team Onboarding Guide**
**File:** `supabase/SEED.md`  
**What it does:**
- Step-by-step instructions for running migrations locally vs. cloud
- Service role key locations (local and cloud)
- Test credentials reference
- Troubleshooting guide
- Development workflow (local first, then cloud)

**Role:** Ensures consistency across team — everyone follows same process, reduces support burden.

---

## 📦 Files, Components & Dependencies

### **New Files Added**

| File | Type | Size | Purpose |
|------|------|------|---------|
| `supabase/schema.sql` (modified) | SQL | 1 line changed | Uncomment auth_user_id |
| `supabase/migrations/20260910150000_*.sql` | SQL | ~100 lines | Idempotent migration for schema + test data |
| `supabase/seed-auth-test-users.ts` | TypeScript | ~120 lines | Seed Supabase Auth users |
| `supabase/SEED.md` | Markdown | ~250 lines | Team onboarding & troubleshooting |

### **Dependencies Used**

| Dependency | Type | Why Needed | Version |
|---|---|---|---|
| `@supabase/supabase-js` | npm package | Admin SDK for creating auth.users | Latest (already in package.json) |
| `supabase` CLI | System tool | Run migrations locally | v1.x+ |
| `ts-node` | Dev dependency | Execute TypeScript seed script | Latest (dev) |
| `typescript` | Dev dependency | Type-check seed script | Latest (dev) |
| PostgreSQL | System | Database backend | v14+ (via Supabase) |

### **No Breaking Changes**
- ✅ Existing code unaffected
- ✅ Existing migrations untouched
- ✅ Backwards-compatible (migration uses `if exists`)
- ✅ Optional (seed script is manual, doesn't auto-run)

---

## 🔄 Team Playbook: What to Do When You Pull This

### **Prerequisites (One-Time Setup)**

Everyone needs these installed:

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase
supabase --version  # Verify

# 2. Authenticate with Supabase
supabase login

# 3. Install app dependencies (if not already done)
pnpm install

# 4. Verify ts-node is available
pnpm add --save-dev ts-node typescript  # If missing
```

### **Immediate Actions (After Pulling)**

```bash
# Terminal 1: Start local Supabase
supabase start
# Output shows local credentials (copy these for step 3)

# Terminal 2: Run the migration
supabase migration up
# Should print: "Completed migration 20260910150000_enable_supabase_auth_and_seed_test_users"

# Terminal 3: Seed test users (use service role key from Terminal 1 output)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="sb_secret_XXXXXXX..." \
pnpm ts-node supabase/seed-auth-test-users.ts

# Should print: "✨ Seed complete!" + test credentials
```

### **Verification Checklist**

After running the playbook above, verify each step worked:

```bash
# 1. Check migration created auth_user_id column
supabase db push  # View schema in Studio at http://127.0.0.1:54323

# 2. Check test accounts exist in database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT name, COUNT(*) FROM user_account WHERE name LIKE 'Test%' GROUP BY name;"
# Should return 6 rows (one per role)

# 3. Check role assignments
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT ua.name, r.role_name FROM user_account ua 
   JOIN user_account_role uar ON ua.user_account_id = uar.user_account_id 
   JOIN role r ON uar.role_id = r.role_id 
   WHERE ua.name LIKE 'Test%';"
# Should return 6 role mappings (one per test account)

# 4. Check auth users were created in Supabase Auth
# Visit Studio: http://127.0.0.1:54323
# Auth > Users tab — should see 6 test users with emails like organiser@test.com
```

### **Test That Everything Works**

```bash
# 1. Start the Next.js dev server
pnpm dev

# 2. Verify environment variables
cat .env.local | grep SUPABASE
# Should show NEXT_PUBLIC_SUPABASE_URL pointing to http://127.0.0.1:54321

# 3. (Upcoming in Tasks 2-7) Test login page will use these credentials
# For now, this prepares the data foundation
```

---

## 🚀 What This Enables Next (Tasks 2-7)

With Task 1 complete, Tasks 2-7 can now:

1. **Core Layer (Task 2):** Build `LoginUseCase` that queries `user_account` and `user_account_role` using test data
2. **Adapter Layer (Task 3):** Build `SupabaseAuthAdapter` that calls Supabase Auth using test users
3. **Middleware (Task 4):** Protect routes using `auth.users` sessions and role lookups
4. **Login Page (Task 5):** Create `/auth/login` form and call `LoginUseCase` with test credentials
5. **Role-Based Redirect (Task 6):** Redirect to `/staff/[role]/dashboard` using roles from `user_account_role`
6. **Testing (Task 7-8):** Run end-to-end tests using test credentials and database state

---

## ⚠️ Important Notes for Team

### **Local vs. Cloud**

| Aspect | Local (pnpm dev:local) | Cloud (pnpm dev:remote) |
|--------|---|---|
| Database | Isolated PostgreSQL in Docker | Supabase Cloud |
| Auth users | Test users only | Production users |
| Risk | Safe to break | Be careful! |
| Migration | `supabase migration up` | Same command (different DB) |
| Seed | Run same script (different key) | Optional (use dashboard instead) |

### **Test Credentials Security**

- ✅ Safe: Committed to repo (hardcoded for local dev convenience)
- ❌ Never use in production (change password immediately if leaked)
- ✅ Best practice: Each environment has different users

### **If Migration Fails**

```bash
# Reset local Supabase (nuclear option)
supabase db reset

# Then re-run
supabase migration up
```

### **If Seed Script Fails**

```bash
# Verify service role key is correct
echo $SUPABASE_SERVICE_ROLE_KEY

# Verify URL is correct
echo $NEXT_PUBLIC_SUPABASE_URL

# Delete failed auth users via Studio (http://127.0.0.1:54323)
# Then re-run seed script
```

---

## 📚 Reference

**Related docs:**
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase CLI Migration Guide](https://supabase.com/docs/guides/cli/local-development)
- See `supabase/SEED.md` for detailed troubleshooting

**Related files:**
- `CLAUDE.md` — Project architecture principles (Ports & Adapters)
- `docs/ARCHITECTURE.md` — Hexagonal architecture (coming in Tasks 2-7)

---

## ✅ Task 1 Completeness Checklist

Before pushing, verify:

- [x] `auth_user_id` uncommented in schema.sql
- [x] Migration file created and tested locally
- [x] Seed script created and tested locally
- [x] SEED.md documentation complete
- [x] All test users created successfully
- [x] All role assignments correct
- [x] No breaking changes to existing code
- [x] Git commits are atomic and clear

**Status:** ✅ Ready to push
