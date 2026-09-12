/**
 * Seed Supabase Auth test users for login feature development.
 *
 * This script creates test users in Supabase Auth and links them to the
 * corresponding user_account records (populated by migrations).
 *
 * Usage (local): SUPABASE_SERVICE_ROLE_KEY="..." npx ts-node supabase/seed-auth-test-users.ts
 * Usage (cloud): Same command (uses cloud service key)
 *
 * IMPORTANT: Use only for testing. Test credentials are hardcoded
 * for development convenience and MUST NOT be used in production.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testUsers = [
  {
    email: "coordinator@test.com",
    password: "TestPass123!",
    name: "Test Coordinator",
    role: "Event Coordinator",
  },
  {
    email: "ops@test.com",
    password: "TestPass123!",
    name: "Test Ops Manager",
    role: "Event Operations Manager",
  },
  {
    email: "venue@test.com",
    password: "TestPass123!",
    name: "Test Venue Staff",
    role: "Venue Staff",
  },
  {
    email: "support@test.com",
    password: "TestPass123!",
    name: "Test Support Staff",
    role: "Technical Support Staff",
  },
];

async function seedAuthUsers() {
  console.log("🌱 Starting Supabase Auth test user seed...\n");

  for (const user of testUsers) {
    try {
      // Create the Supabase Auth user
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email for testing
      });

      if (authError) {
        console.error(`❌ Failed to create auth user ${user.email}:`, authError.message);
        continue;
      }

      if (!authUser.user?.id) {
        console.error(`❌ Auth user created but no ID returned for ${user.email}`);
        continue;
      }

      // Link the auth user to the user_account by updating auth_user_id
      const { error: linkError } = await adminClient
        .from("user_account")
        .update({ auth_user_id: authUser.user.id })
        .eq("name", user.name);

      if (linkError) {
        console.error(`❌ Failed to link auth user to user_account for ${user.name}:`, linkError.message);
        continue;
      }

      console.log(`✅ ${user.role}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Auth ID: ${authUser.user.id}\n`);
    } catch (err) {
      console.error(`❌ Unexpected error seeding ${user.email}:`, err);
    }
  }

  console.log("✨ Seed complete!");
  console.log("\n📝 Test Credentials Summary:");
  console.log("=============================");
  testUsers.forEach((user) => {
    console.log(`${user.role}: ${user.email} / ${user.password}`);
  });
  console.log("=============================\n");
}

seedAuthUsers().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
