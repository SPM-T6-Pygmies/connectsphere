import { VenueUnavailabilityNotPermittedError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { canMaintainVenues } from "../domain/venue";
import type { VenueUnavailabilityEntry } from "../domain/venue-unavailability";
import type { VenueUnavailabilityRepository } from "../ports/outbound/venue-unavailability-repository";

export interface ListVenueUnavailabilityCommand {
  readonly roles: readonly string[];
  readonly userAccountId: string;
}

export interface ListVenueUnavailabilityResult {
  /** In force first, then soonest start; Lifted blocks follow, most recently lifted first. */
  readonly entries: readonly VenueUnavailabilityEntry[];
}

export interface ListVenueUnavailabilityDeps {
  readonly unavailability: VenueUnavailabilityRepository;
}

/** SPM-21 AC1, AC16: the blocks on every venue, In force and Lifted. Decides nothing beyond the order. */
export class ListVenueUnavailabilityUseCase {
  constructor(private readonly deps: ListVenueUnavailabilityDeps) {}

  async execute(command: ListVenueUnavailabilityCommand): Promise<ListVenueUnavailabilityResult> {
    if (!canMaintainVenues(command.roles)) {
      throw new VenueUnavailabilityNotPermittedError();
    }
    const all = await this.deps.unavailability.list(userAccountId(command.userAccountId));

    const inForce = all
      .filter((entry) => entry.status === "In force")
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.venueLocation.localeCompare(b.venueLocation));
    const lifted = all
      .filter((entry) => entry.status === "Lifted")
      .sort((a, b) => (b.liftedAt ?? "").localeCompare(a.liftedAt ?? ""));
    return { entries: [...inForce, ...lifted] };
  }
}
