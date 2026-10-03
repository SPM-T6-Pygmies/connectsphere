import type { BusyInterval } from "@/core/domain/venue-search";
import type { VenueAvailability } from "@/core/ports/outbound/venue-availability";

/** Busy intervals held in an array; same overlap contract as the Supabase one. */
export class InMemoryVenueAvailability implements VenueAvailability {
  constructor(private readonly busy: readonly BusyInterval[] = []) {}

  async busyIntervals(from: Date, to: Date): Promise<readonly BusyInterval[]> {
    return this.busy.filter(
      (interval) =>
        interval.startsAt.getTime() < to.getTime() && interval.endsAt.getTime() > from.getTime(),
    );
  }
}
