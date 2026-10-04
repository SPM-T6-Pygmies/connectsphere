import { BOOKING_SLOTS, isBookingSlot, type BookingSlot } from "./booking";
import type { Brand } from "./brand";
import { InvalidVenueError, InvalidVenueIdError, type VenueField } from "./errors";
import {
  ACCESSIBILITY_OPTIONS,
  FACILITY_OPTIONS,
  formatOptionList,
  parseOptionList,
  unknownOptions,
} from "./venue-options";

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
  /** The day slots the venue can be booked in, in `BOOKING_SLOTS` order. */
  readonly slots: readonly BookingSlot[];
  /**
   * The venue-level headline capacity, kept exactly as supplied. It is not
   * derived from the layouts, but no layout may seat more than it (SPM-106).
   */
  readonly capacity: number | null;
  /** How many days ahead the venue can be booked. */
  readonly bookingHorizonDays: number | null;
  readonly layouts: readonly VenueLayout[];
}

export interface Venue extends VenueDetails {
  readonly id: VenueId;
}

/** The only room layouts a venue can list, so requests and venues match by name. */
export const STANDARD_LAYOUTS = [
  "Classroom",
  "Theatre",
  "Boardroom",
  "Banquet",
  "Exhibition",
] as const;

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
 * is exactly what SPM-42 AC2 rules out. Nor may a layout seat more than the
 * venue itself (SPM-106).
 */
export function defineVenue(input: VenueDetails): VenueDetails {
  const location = requiredText(input.location, "Enter the location.", "location");
  const facilities = requiredOptions(
    input.facilities,
    FACILITY_OPTIONS,
    "Select at least one facility.",
    "facilities",
  );
  const accessibility = requiredOptions(
    input.accessibility,
    ACCESSIBILITY_OPTIONS,
    "Select at least one accessibility feature.",
    "accessibility",
  );

  if (input.slots.length === 0) {
    throw new InvalidVenueError("Select at least one slot the venue can be booked in.", "slots");
  }
  const unknownSlots = input.slots.filter((slot) => !isBookingSlot(slot));
  if (unknownSlots.length > 0) {
    throw new InvalidVenueError(
      `${unknownSlots.join(", ")} is not a slot -- choose from ${BOOKING_SLOTS.join(", ")}.`,
      "slots",
    );
  }
  const slots = BOOKING_SLOTS.filter((slot) => input.slots.includes(slot));

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
  const venueCapacity = input.capacity;
  const seen = new Set<string>();
  const layouts = input.layouts.map((layout) => {
    const name = layout.name.trim();
    if (name.length === 0) {
      throw new InvalidVenueError("Every room layout needs a name.", "layouts");
    }
    if (!(STANDARD_LAYOUTS as readonly string[]).includes(name)) {
      throw new InvalidVenueError(
        `${name} is not a room layout -- choose one of ${STANDARD_LAYOUTS.join(", ")}.`,
        "layouts",
      );
    }
    if (!Number.isInteger(layout.capacity) || layout.capacity <= 0) {
      throw new InvalidVenueError(
        `Enter a capacity above 0 for the ${name} layout -- it is not worked out for you.`,
        "layouts",
      );
    }
    if (exceedsVenueCapacity(layout.capacity, venueCapacity)) {
      throw new InvalidVenueError(
        `The ${name} layout cannot seat more than the venue's capacity of ${venueCapacity}.`,
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
    slots,
    capacity: input.capacity,
    bookingHorizonDays: input.bookingHorizonDays,
    layouts,
  };
}

/** A layout may seat as many as the venue, but not more (SPM-106). */
export function exceedsVenueCapacity(layoutCapacity: number, venueCapacity: number): boolean {
  return layoutCapacity > venueCapacity;
}

function requiredText(value: string | null, message: string, field: VenueField): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    throw new InvalidVenueError(message, field);
  }
  return trimmed;
}

function requiredOptions(
  value: string | null,
  allowed: readonly string[],
  message: string,
  field: VenueField,
): string {
  const selected = parseOptionList(value);
  if (selected.length === 0) {
    throw new InvalidVenueError(message, field);
  }
  const unknown = unknownOptions(value, allowed);
  if (unknown.length > 0) {
    throw new InvalidVenueError(
      `${unknown.join(", ")} is not an option -- choose from ${allowed.join(", ")}.`,
      field,
    );
  }
  return formatOptionList(selected);
}
