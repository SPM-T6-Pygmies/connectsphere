import type { BookedSlot } from "@/core/domain/venue-search";
import type { VenueAvailability } from "@/core/ports/outbound/venue-availability";

/** Booked slots held in an array; same contract as the Supabase one. */
export class InMemoryVenueAvailability implements VenueAvailability {
  constructor(private readonly booked: readonly BookedSlot[] = []) {}

  async bookedSlots(date: string): Promise<readonly BookedSlot[]> {
    return this.booked.filter((held) => held.date === date);
  }
}
