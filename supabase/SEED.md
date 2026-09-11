# Database Setup & Test Data Seeding

This guide walks through enabling Supabase Auth integration and seeding test user data for login feature development.

## Prerequisites

- Supabase CLI installed: https://supabase.com/docs/guides/cli/getting-started
- `supabase login` completed to authenticate with your account

## Step 1: Run Supabase Migrations

Apply all pending migrations to your database (local or cloud):

**For local development:**
```bash
pnpm dev:local              # Starts local Supabase (safe space to test)
supabase migration up       # Runs migrations locally
```

**For production (after verifying locally):**
```bash
pnpm dev:remote             # Connects to Supabase Cloud
supabase migration up       # Runs migrations on cloud
```

This will:
- Uncomment and activate the `auth_user_id` column on `user_account`
- Seed test staff user_account records with roles (Event Organiser, Coordinator, Ops Manager, Venue Staff, Support Staff)

**Verification (local or cloud):**
```sql
-- Check that test staff accounts were created
select ua.user_account_id, ua.name, r.role_name
from user_account ua
join user_account_role uar on ua.user_account_id = uar.user_account_id
join role r on uar.role_id = r.role_id
where ua.name like 'Test%';
```

Expected output: 5 rows (one per staff role)

## Step 2: Seed Supabase Auth Users

Create the actual auth.users entries with test credentials and link them to the user_account records.

**For local development:**
```bash
# Get your local service role key (displayed when pnpm dev:local starts)
# or from .env.local SUPABASE_SERVICE_ROLE_KEY=...

SUPABASE_SERVICE_ROLE_KEY="your-local-key-here" npx ts-node supabase/seed-auth-test-users.ts
```

**For production (after verifying locally):**
```bash
# Get your cloud service role key from Supabase dashboard:
# Project Settings → API → Service Role

SUPABASE_SERVICE_ROLE_KEY="your-cloud-key-here" npx ts-node supabase/seed-auth-test-users.ts
```

**Finding Your Service Role Key:**

*Local:* Check the output when you ran `pnpm dev:local`, or in `.env.local`

*Cloud:* In your Supabase dashboard:
1. Navigate to **Project Settings** → **API**
2. Copy the **Service Role** key (marked "DANGER: used by your server")

## Test Credentials

Use these credentials to test the login flow:

| Role | Email | Password |
|------|-------|----------|
| Event Organiser | `organiser@test.com` | `TestPass123!` |
| Event Coordinator | `coordinator@test.com` | `TestPass123!` |
| Event Operations Manager | `ops@test.com` | `TestPass123!` |
| Venue Staff | `venue@test.com` | `TestPass123!` |
| Technical Support Staff | `support@test.com` | `TestPass123!` |

## Development Workflow

1. **Make schema changes** → Update `supabase/schema.sql` or create new migration
2. **Test locally first:** 
   ```bash
   pnpm dev:local
   supabase migration up
   ```
3. **Seed test data locally:**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY="..." npx ts-node supabase/seed-auth-test-users.ts
   ```
4. **Test your feature** on local Supabase
5. **When verified:** Push changes to main, then on prod:
   ```bash
   pnpm dev:remote
   supabase migration up
   SUPABASE_SERVICE_ROLE_KEY="..." npx ts-node supabase/seed-auth-test-users.ts
   ```

## Resetting Test Data

To clear test data and start fresh:

**Local:**
```bash
supabase db reset
```

**Cloud (destructive - use with caution):**
```bash
pnpm dev:remote
supabase db reset  # ⚠️  Resets entire cloud database
```

Then re-run Step 2 above.

## Troubleshooting

### Migration Failed

Ensure your Supabase instance is running:
```bash
supabase status
```

If not running:
```bash
supabase start  # or pnpm dev:local
```

### Seed Script Failed

Check that:
- `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Supabase is running (`supabase status`)
- TypeScript/Node.js is installed: `npm install -g ts-node`

If you get "module not found" errors:
```bash
npm install @supabase/supabase-js
```

### "Email already exists" During Seed

The test accounts may already be seeded. Either:
1. Delete them via Supabase dashboard (Authentication → Users) and re-run, or
2. Just use the existing credentials listed above, or
3. Reset with `supabase db reset` and re-seed

## Next Steps

Once test data is seeded:
1. Start the dev server: `pnpm dev` (or `pnpm dev:local`)
2. Navigate to `http://localhost:3000/auth/login`
3. Test login with the credentials above
4. Verify role-based redirects work correctly
