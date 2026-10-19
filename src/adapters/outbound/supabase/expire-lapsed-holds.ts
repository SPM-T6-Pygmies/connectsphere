import type { SupabaseServerClient } from "./client";

/**
 * SPM-253: marks every Tentative Hold at or past its expiry as Expired, once,
 * with its audit row. The app has no scheduler, so a lapsed hold is marked when
 * the data that shows it is next read. Idempotent, so a read that finds nothing
 * lapsed costs one cheap call. The stored expiry stays the true moment it lapsed.
 */
export async function expireLapsedHolds(client: SupabaseServerClient): Promise<void> {
  const { error } = await client.rpc("expire_lapsed_holds");
  if (error) {
    throw new Error(`Failed to expire lapsed holds: ${error.message}`, { cause: error });
  }
}
