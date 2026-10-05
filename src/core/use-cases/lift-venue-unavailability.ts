import {
  VenueUnavailabilityNotFoundError,
  VenueUnavailabilityNotPermittedError,
} from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { canMaintainVenues } from "../domain/venue";
import { liftVenueUnavailability, type VenueUnavailabilityEntry } from "../domain/venue-unavailability";
import type { Clock } from "../ports/outbound/clock";
import type { VenueUnavailabilityRepository } from "../ports/outbound/venue-unavailability-repository";

export interface LiftVenueUnavailabilityCommand {
  readonly roles: readonly string[];
  /** The Venue Staff member lifting the block. */
  readonly userAccountId: string;
  readonly unavailabilityId: string;
}

export interface LiftVenueUnavailabilityResult {
  /** The block as it stands now, Lifted, with who and when. */
  readonly entry: VenueUnavailabilityEntry;
}

export interface LiftVenueUnavailabilityDeps {
  readonly unavailability: VenueUnavailabilityRepository;
  readonly clock: Clock;
}

/** SPM-21 AC15-AC17: Venue Staff lift a block early. It stays on record as Lifted. */
export class LiftVenueUnavailabilityUseCase {
  constructor(private readonly deps: LiftVenueUnavailabilityDeps) {}

  async execute(command: LiftVenueUnavailabilityCommand): Promise<LiftVenueUnavailabilityResult> {
    const { unavailability, clock } = this.deps;
    if (!canMaintainVenues(command.roles)) {
      throw new VenueUnavailabilityNotPermittedError();
    }
    const staff = userAccountId(command.userAccountId);

    const entry = await unavailability.find(staff, command.unavailabilityId);
    if (entry === null) {
      throw new VenueUnavailabilityNotFoundError();
    }

    await unavailability.lift(liftVenueUnavailability(entry, staff, clock.now()));

    const lifted = await unavailability.find(staff, command.unavailabilityId);
    if (lifted === null) {
      throw new VenueUnavailabilityNotFoundError();
    }
    return { entry: lifted };
  }
}
