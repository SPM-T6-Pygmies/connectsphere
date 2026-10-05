import type { BookingSlot } from "@/core/domain/booking";
import { venueId, type Venue, type VenueDetails } from "@/core/domain/venue";

/** One venue as `public.venue_catalogue()` returns it. */
export interface VenueRow {
  venue_id: number;
  location: string;
  facilities: string | null;
  accessibility: string | null;
  /** `venue_slot` codes, in the order the day runs. */
  slots: BookingSlot[];
  capacity: number | null;
  booking_horizon_days: number | null;
  layouts: { name: string; capacity: number }[];
}

export function toVenue(row: VenueRow): Venue {
  return {
    id: venueId(String(row.venue_id)),
    location: row.location,
    facilities: row.facilities,
    accessibility: row.accessibility,
    slots: [...row.slots],
    capacity: row.capacity,
    bookingHorizonDays: row.booking_horizon_days,
    layouts: row.layouts.map(({ name, capacity }) => ({ name, capacity })),
  };
}

/** The argument `venue_catalogue_create` / `venue_catalogue_update` take. */
export function toVenueArgument(details: VenueDetails) {
  return {
    location: details.location,
    facilities: details.facilities,
    accessibility: details.accessibility,
    slots: [...details.slots],
    capacity: details.capacity,
    booking_horizon_days: details.bookingHorizonDays,
    layouts: details.layouts.map(({ name, capacity }) => ({ name, capacity })),
  };
}
