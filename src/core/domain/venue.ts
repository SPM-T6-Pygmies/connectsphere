import type { Brand } from "./brand";
import { InvalidVenueError, InvalidVenueIdError, type VenueField } from "./errors";

export type VenueId = Brand<string, "VenueId">;

export function venueId(raw: string): VenueId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidVenueIdError(raw);
  }
  return trimmed as VenueId;
}

/**
 * A room layout a venue supports, with the capacity the venue itself supplies
 * for it (#112). Capacity is an input, never something the system estimates or
 * derives -- see SPM-106 for how it relates to the venue-level scalar, which
 * this record deliberately does not carry.
 */
export interface VenueLayout {
  readonly name: string;
  readonly capacity: number;
}

/** What Venue Staff maintain about a venue (wiki: venue, SPM-42). */
export interface VenueDetails {
  readonly location: string;
  readonly facilities: string | null;
  readonly accessibility: string | null;
  /** `HH:MM`, 24-hour. */
  readonly operatingHoursStart: string | null;
  readonly operatingHoursEnd: string | null;
  /**
   * The venue-level headline capacity, kept exactly as supplied. It is neither
   * derived from the layouts nor checked against them: which one wins is SPM-106.
   */
  readonly capacity: number | null;
  /** How many days ahead the venue can be booked. */
  readonly bookingHorizonDays: number | null;
  readonly layouts: readonly VenueLayout[];
}

export interface Venue extends VenueDetails {
  readonly id: VenueId;
}

/** The layouts the catalogue names. Any other layout is "another" -- free text. */
export const STANDARD_LAYOUTS = [
  "Classroom",
  "Theatre",
  "Boardroom",
  "Banquet",
  "Exhibition",
] as const;

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Only Venue Staff maintain the catalogue, at any venue or location (#66). */
export function canMaintainVenues(roles: readonly string[]): boolean {
  return roles.includes("Venue Staff");
}

/**
 * The only way to obtain valid `VenueDetails`: trims, and refuses a record the
 * catalogue must not hold -- so create and update cannot disagree about it.
 *
 * Every attribute is mandatory, and at least one layout must be listed. A
 * layout's capacity must be supplied and positive: there is no default and no
 * fallback to the venue's own figure -- "the system would have to compute it"
 * is exactly what SPM-42 AC2 rules out.
 */
export function defineVenue(input: VenueDetails): VenueDetails {
  const location = requiredText(input.location, "Enter the location.", "location");
  const facilities = requiredText(input.facilities, "Enter the facilities.", "facilities");
  const accessibility = requiredText(
    input.accessibility,
    "Enter the accessibility details.",
    "accessibility",
  );

  const start = input.operatingHoursStart;
  const end = input.operatingHoursEnd;
  if (start === null) {
    throw new InvalidVenueError("Enter the opening time.", "operatingHoursStart");
  }
  if (!TIME_OF_DAY.test(start)) {
    throw new InvalidVenueError("Enter the opening time as HH:MM.", "operatingHoursStart");
  }
  if (end === null) {
    throw new InvalidVenueError("Enter the closing time.", "operatingHoursEnd");
  }
  if (!TIME_OF_DAY.test(end)) {
    throw new InvalidVenueError("Enter the closing time as HH:MM.", "operatingHoursEnd");
  }
  // Zero-padded HH:MM, so string order is time order.
  if (end <= start) {
    throw new InvalidVenueError(
      "Closing time must be later than the opening time.",
      "operatingHoursEnd",
    );
  }

  if (input.capacity === null) {
    throw new InvalidVenueError("Enter the venue capacity.", "capacity");
  }
  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    throw new InvalidVenueError("Venue capacity must be a whole number above 0.", "capacity");
  }
  if (input.bookingHorizonDays === null) {
    throw new InvalidVenueError("Enter the booking horizon in days.", "bookingHorizonDays");
  }
  if (!Number.isInteger(input.bookingHorizonDays) || input.bookingHorizonDays < 0) {
    throw new InvalidVenueError(
      "Booking horizon must be a whole number of days, 0 or more.",
      "bookingHorizonDays",
    );
  }

  if (input.layouts.length === 0) {
    throw new InvalidVenueError("Add at least one supported room layout.", "layouts");
  }
  const seen = new Set<string>();
  const layouts = input.layouts.map((layout) => {
    const name = layout.name.trim();
    if (name.length === 0) {
      throw new InvalidVenueError("Every room layout needs a name.", "layouts");
    }
    if (!Number.isInteger(layout.capacity) || layout.capacity <= 0) {
      throw new InvalidVenueError(
        `Enter a capacity above 0 for the ${name} layout -- it is not worked out for you.`,
        "layouts",
      );
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new InvalidVenueError(`The ${name} layout is listed more than once.`, "layouts");
    }
    seen.add(key);
    return { name, capacity: layout.capacity };
  });

  return {
    location,
    facilities,
    accessibility,
    operatingHoursStart: start,
    operatingHoursEnd: end,
    capacity: input.capacity,
    bookingHorizonDays: input.bookingHorizonDays,
    layouts,
  };
}

function requiredText(value: string | null, message: string, field: VenueField): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    throw new InvalidVenueError(message, field);
  }
  return trimmed;
}
