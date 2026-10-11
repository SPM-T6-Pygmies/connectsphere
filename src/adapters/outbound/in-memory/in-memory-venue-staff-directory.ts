import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { VenueStaffDirectory } from "@/core/ports/outbound/venue-staff-directory";

export class InMemoryVenueStaffDirectory implements VenueStaffDirectory {
  private readonly staff: readonly UserAccountId[];

  constructor(staff: readonly string[] = []) {
    this.staff = staff.map(userAccountId);
  }

  async venueStaff(): Promise<readonly UserAccountId[]> {
    return this.staff;
  }
}
