import { venueId, type Venue, type VenueDetails } from "@/core/domain/venue";

/** One venue as `public.venue_catalogue()` returns it. */
export interface VenueRow {
  venue_id: number;
  location: string;
  facilities: string | null;
  accessibility: string | null;
  /** `venue_slot` joined into windows as `HH:MM`, earliest first (SPM-320). */
  opening_hours: { start: string; end: string }[];
  capacity: number | null;
  booking_horizon_days: number | null;
  /** SPM-23: null until defined. */
  setup_minutes: number | null;
  turnaround_minutes: number | null;
  layouts: { name: string; capacity: number }[];
}

export function toVenue(row: VenueRow): Venue {
  return {
    id: venueId(String(row.venue_id)),
    location: row.location,
    facilities: row.facilities,
    accessibility: row.accessibility,
    openingHours: row.opening_hours.map(({ start, end }) => ({ start, end })),
    capacity: row.capacity,
    bookingHorizonDays: row.booking_horizon_days,
    setupMinutes: row.setup_minutes,
    turnaroundMinutes: row.turnaround_minutes,
    layouts: row.layouts.map(({ name, capacity }) => ({ name, capacity })),
  };
}

/** The argument `venue_catalogue_create` / `venue_catalogue_update` take. */
export function toVenueArgument(details: VenueDetails) {
  return {
    location: details.location,
    facilities: details.facilities,
    accessibility: details.accessibility,
    opening_hours: details.openingHours.map(({ start, end }) => ({ start, end })),
    capacity: details.capacity,
    booking_horizon_days: details.bookingHorizonDays,
    setup_minutes: details.setupMinutes ?? null,
    turnaround_minutes: details.turnaroundMinutes ?? null,
    layouts: details.layouts.map(({ name, capacity }) => ({ name, capacity })),
  };
}
