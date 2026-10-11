import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { VenueStaffDirectory } from "@/core/ports/outbound/venue-staff-directory";

import type { SupabaseAdminClient } from "./client";

/**
 * SPM-61, through the service-role-only `venue_staff_ids` in
 * 20261016000000_venue_staff_ids.sql: the coordinator submitting the request
 * may not list staff accounts themselves.
 */
export class SupabaseVenueStaffDirectory implements VenueStaffDirectory {
  constructor(private readonly client: SupabaseAdminClient) {}

  async venueStaff(): Promise<readonly UserAccountId[]> {
    const { data, error } = await this.client.rpc("venue_staff_ids");
    if (error) {
      throw new Error(`Failed to read the Venue Staff: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as { user_account_id: number }[]).map((row) =>
      userAccountId(String(row.user_account_id)),
    );
  }
}
