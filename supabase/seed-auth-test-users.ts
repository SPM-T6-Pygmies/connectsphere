/**
 * Seed Supabase Auth test users for login feature development.
 *
 * This script creates test users in Supabase Auth, creates the corresponding
 * user_account and user_account_role records if they are missing, and links
 * them. Re-running it reuses existing auth users and records.
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
    email: "organiser@test.com",
    password: "TestPass123!",
    name: "Test Organiser",
    role: "Event Organiser",
    clientOrganisation: "Test Organisation",
  },
  {
    email: "organiser2@test.com",
    password: "TestPass123!",
    name: "Test Organiser 2",
    role: "Event Organiser",
    clientOrganisation: "Test Organisation",
  },
  {
    email: "coordinator@test.com",
    password: "TestPass123!",
    name: "Test Coordinator",
    role: "Event Coordinator",
    clientOrganisation: null,
  },
  {
    email: "ops@test.com",
    password: "TestPass123!",
    name: "Test Ops Manager",
    role: "Event Operations Manager",
    clientOrganisation: null,
  },
  {
    email: "venue@test.com",
    password: "TestPass123!",
    name: "Test Venue Staff",
    role: "Venue Staff",
    clientOrganisation: null,
  },
  {
    email: "support@test.com",
    password: "TestPass123!",
    name: "Test Support Staff",
    role: "Technical Support Staff",
    clientOrganisation: null,
  },
];

async function seedAuthUsers() {
  console.log("🌱 Starting Supabase Auth test user seed...\n");

  // Reuse auth users from an earlier run instead of failing with email_exists
  const { data: existing, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    console.error("❌ Failed to list existing auth users:", listError.message);
    process.exit(1);
  }

  const existingAuthUserIds = new Map(existing.users.map((authUser) => [authUser.email, authUser.id]));

  for (const user of testUsers) {
    try {
      let authUserId = existingAuthUserIds.get(user.email);

      if (!authUserId) {
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

        authUserId = authUser.user.id;
      }

      // Find the user_account, creating it if a migration didn't (or it was deleted)
      const { data: account, error: findError } = await adminClient
        .from("user_account")
        .select("user_account_id")
        .eq("name", user.name)
        .maybeSingle();

      if (findError) {
        console.error(`❌ Failed to look up user_account for ${user.name}:`, findError.message);
        continue;
      }

      let userAccountId: number | undefined = account?.user_account_id;

      if (!userAccountId) {
        let clientOrganisationId: number | null = null;

        if (user.clientOrganisation) {
          const { data: organisation, error: organisationError } = await adminClient
            .from("client_organisation")
            .select("client_organisation_id")
            .eq("name", user.clientOrganisation)
            .limit(1)
            .single();

          if (organisationError) {
            console.error(
              `❌ Failed to find client_organisation ${user.clientOrganisation} for ${user.name}:`,
              organisationError.message
            );
            continue;
          }

          clientOrganisationId = organisation.client_organisation_id;
        }

        const { data: createdAccount, error: createAccountError } = await adminClient
          .from("user_account")
          .insert({ name: user.name, client_organisation_id: clientOrganisationId })
          .select("user_account_id")
          .single();

        if (createAccountError) {
          console.error(`❌ Failed to create user_account for ${user.name}:`, createAccountError.message);
          continue;
        }

        userAccountId = createdAccount.user_account_id;
      }

      // Give the user_account its role (does nothing if it already has it)
      const { data: role, error: roleError } = await adminClient
        .from("role")
        .select("role_id")
        .eq("role_name", user.role)
        .single();

      if (roleError) {
        console.error(`❌ Failed to find role ${user.role} for ${user.name}:`, roleError.message);
        continue;
      }

      const { error: assignRoleError } = await adminClient
        .from("user_account_role")
        .upsert(
          { user_account_id: userAccountId, role_id: role.role_id },
          { onConflict: "user_account_id,role_id", ignoreDuplicates: true }
        );

      if (assignRoleError) {
        console.error(`❌ Failed to assign role ${user.role} to ${user.name}:`, assignRoleError.message);
        continue;
      }

      // Link the auth user to the user_account by updating auth_user_id
      const { error: linkError } = await adminClient
        .from("user_account")
        .update({ auth_user_id: authUserId })
        .eq("user_account_id", userAccountId);

      if (linkError) {
        console.error(`❌ Failed to link auth user to user_account for ${user.name}:`, linkError.message);
        continue;
      }

      console.log(`✅ ${user.role}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Auth ID: ${authUserId}\n`);
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
