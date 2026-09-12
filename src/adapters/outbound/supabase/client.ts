import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

/**
 * Framework coupling lives here, and only here.
 *
 * `next/headers` is imported in an adapter, which is fine -- adapters are
 * allowed to know what they are adapting. The lint rules stop this import from
 * reaching `src/core`, which is the boundary that actually matters.
 */

/**
 * Admin client with full permissions (bypasses RLS).
 * Use for server-side operations that need direct database access.
 * Example: authentication, user lookups, internal admin queries.
 */
export function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}

/**
 * Session client with cookie-based authentication.
 * Respects user's current session and RLS policies.
 * Use for user-scoped queries that should respect the current user's permissions.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; middleware refreshes them.
          }
        },
      },
    },
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
