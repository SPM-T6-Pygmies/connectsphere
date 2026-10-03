import { BOOKING_SLOTS, SLOT_HOURS, type BookingSlot } from "./booking";
import { InvalidVenueSearchError } from "./errors";
import { STANDARD_LAYOUTS, type Venue, type VenueId } from "./venue";
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, parseOptionList } from "./venue-options";

/**
 * SPM-44: narrowing the venue catalogue to candidates.
 *
 * A search answers "which venues could host this?", never "is this venue
 * suitable?" -- the result is a list of venues with no verdict or flag on them
 * (#83). Every criterion is optional; a blank one is simply not applied.
 */
export interface VenueSearchCriteria {
  /** One of `STANDARD_LAYOUTS`. */
  readonly layout: string | null;
  /** How many people the layout must seat. */
  readonly attendance: number | null;
  readonly facilities: readonly string[];
  readonly accessibility: readonly string[];
  readonly window: VenueSearchWindow | null;
}

/** When the event would run: one day, in one or more of the fixed time slots. */
export interface VenueSearchWindow {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** At least one, in the order the slots fall in a day. */
  readonly slots: readonly BookingSlot[];
}

/** A slot a venue is held for by a live booking. */
export interface BookedSlot {
  readonly venueId: VenueId;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly slot: BookingSlot;
}

export interface VenueSearchInput {
  readonly layout: string | null;
  readonly attendance: number | null;
  readonly facilities: readonly string[];
  readonly accessibility: readonly string[];
  readonly date: string | null;
  /** Slot codes (`AM`, `PM`, `Night`); blanks are ignored. */
  readonly slots: readonly string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The only way to obtain `VenueSearchCriteria`. Refuses a search that cannot be
 * answered: a date without a time slot (or a slot without a date), a date
 * already past, or a value that is not an option. `today` is `YYYY-MM-DD` at
 * the venues.
 */
export function defineVenueSearch(input: VenueSearchInput, today: string): VenueSearchCriteria {
  const layout = blankToNull(input.layout);
  if (layout !== null && !(STANDARD_LAYOUTS as readonly string[]).includes(layout)) {
    throw new InvalidVenueSearchError(
      `${layout} is not a room layout -- choose one of ${STANDARD_LAYOUTS.join(", ")}.`,
      "layout",
    );
  }

  const attendance = input.attendance;
  if (attendance !== null && (!Number.isInteger(attendance) || attendance <= 0)) {
    throw new InvalidVenueSearchError(
      "Attendance must be a whole number above 0.",
      "attendance",
    );
  }

  const facilities = knownOptions(input.facilities, FACILITY_OPTIONS, "facilities");
  const accessibility = knownOptions(input.accessibility, ACCESSIBILITY_OPTIONS, "accessibility");

  return {
    layout,
    attendance,
    facilities,
    accessibility,
    window: defineWindow(input, today),
  };
}

function defineWindow(input: VenueSearchInput, today: string): VenueSearchWindow | null {
  const date = blankToNull(input.date);
  const chosen = input.slots.map((slot) => slot.trim()).filter((slot) => slot.length > 0);

  if (date === null && chosen.length === 0) {
    return null;
  }
  if (date === null) {
    throw new InvalidVenueSearchError("Choose the event date.", "date");
  }
  if (chosen.length === 0) {
    throw new InvalidVenueSearchError("Choose at least one time slot.", "slots");
  }
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new InvalidVenueSearchError("Enter the date as YYYY-MM-DD.", "date");
  }
  if (date < today) {
    throw new InvalidVenueSearchError("Choose a date from today onwards.", "date");
  }
  const unknown = chosen.filter((slot) => !(BOOKING_SLOTS as readonly string[]).includes(slot));
  if (unknown.length > 0) {
    throw new InvalidVenueSearchError(
      `${unknown.join(", ")} is not a time slot -- choose from ${BOOKING_SLOTS.join(", ")}.`,
      "slots",
    );
  }
  // In the order the slots fall in a day, whatever order they were asked for.
  return { date, slots: BOOKING_SLOTS.filter((slot) => chosen.includes(slot)) };
}

/**
 * Why a venue was left out of a search, named after the filter it failed.
 * Explains the filter, not the venue's suitability (#83).
 */
export const EXCLUSION_REASONS = [
  "layout",
  "capacity",
  "facilities",
  "accessibility",
  "hoursUnknown",
  "outsideHours",
  "beyondHorizon",
  "booked",
] as const;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export interface VenueSearchOutcome {
  /** The candidates, in the order the catalogue listed them. May be empty. */
  readonly venues: Venue[];
  /**
   * How many venues each reason left out, in `EXCLUSION_REASONS` order, zero
   * counts omitted. A venue is counted once, under the first filter it fails.
   */
  readonly excluded: readonly { readonly reason: ExclusionReason; readonly count: number }[];
}

/**
 * The venues that meet every criterion given, and why the rest did not.
 *
 * `booked` must cover the searched date.
 */
export function searchVenues(
  venues: readonly Venue[],
  criteria: VenueSearchCriteria,
  booked: readonly BookedSlot[],
  today: string,
): VenueSearchOutcome {
  const matched: Venue[] = [];
  const counts = new Map<ExclusionReason, number>();
  for (const venue of venues) {
    const reason =
      attributeMismatch(venue, criteria) ??
      (criteria.window === null ? null : unavailability(venue, criteria.window, booked, today));
    if (reason === null) {
      matched.push(venue);
    } else {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return {
    venues: matched,
    excluded: EXCLUSION_REASONS.filter((reason) => counts.has(reason)).map((reason) => ({
      reason,
      count: counts.get(reason) ?? 0,
    })),
  };
}

export function matchesAttributes(venue: Venue, criteria: VenueSearchCriteria): boolean {
  return attributeMismatch(venue, criteria) === null;
}

/**
 * Layout and attendance are tested on the same (venue, layout) pair (#112): a
 * venue whose Theatre seats 200 does not match "Boardroom for 100" because its
 * Boardroom seats 20. The venue-level `capacity` is never consulted (SPM-106).
 */
function attributeMismatch(venue: Venue, criteria: VenueSearchCriteria): ExclusionReason | null {
  const { layout, attendance } = criteria;
  if (layout !== null && !venue.layouts.some((candidate) => candidate.name === layout)) {
    return "layout";
  }
  if (
    attendance !== null &&
    !venue.layouts.some(
      (candidate) =>
        (layout === null || candidate.name === layout) && candidate.capacity >= attendance,
    )
  ) {
    return "capacity";
  }
  if (!includesAll(venue.facilities, criteria.facilities)) return "facilities";
  if (!includesAll(venue.accessibility, criteria.accessibility)) return "accessibility";
  return null;
}

export function isOpenFor(
  venue: Venue,
  window: VenueSearchWindow,
  booked: readonly BookedSlot[],
  today: string,
): boolean {
  return unavailability(venue, window, booked, today) === null;
}

/**
 * Whether the venue could be booked for every slot asked for: operating at some
 * point within each slot, within its booking horizon, and with none of those
 * slots held by a live booking. A venue missing the hours or horizon cannot be
 * shown to be open, so it is not.
 */
function unavailability(
  venue: Venue,
  window: VenueSearchWindow,
  booked: readonly BookedSlot[],
  today: string,
): ExclusionReason | null {
  const { operatingHoursStart: opens, operatingHoursEnd: closes, bookingHorizonDays } = venue;
  if (opens === null || closes === null || bookingHorizonDays === null) {
    return "hoursUnknown";
  }
  // Zero-padded HH:MM, so string order is time order. Half-open: a venue that
  // closes as a slot starts, or opens as it ends, is not operating within it.
  const operatesIn = (slot: BookingSlot) =>
    opens < SLOT_HOURS[slot].end && closes > SLOT_HOURS[slot].start;
  if (!window.slots.every(operatesIn)) {
    return "outsideHours";
  }
  if (daysBetween(today, window.date) > bookingHorizonDays) {
    return "beyondHorizon";
  }

  const taken = booked.some(
    (held) =>
      held.venueId === venue.id && held.date === window.date && window.slots.includes(held.slot),
  );
  return taken ? "booked" : null;
}

/** `now`'s calendar date (`YYYY-MM-DD`) in `timeZone`. */
export function calendarDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function includesAll(stored: string | null, wanted: readonly string[]): boolean {
  const have = parseOptionList(stored);
  return wanted.every((option) => have.includes(option));
}

function knownOptions(
  values: readonly string[],
  allowed: readonly string[],
  field: "facilities" | "accessibility",
): string[] {
  const selected = values.map((value) => value.trim()).filter((value) => value.length > 0);
  const unknown = selected.filter((value) => !allowed.includes(value));
  if (unknown.length > 0) {
    throw new InvalidVenueSearchError(
      `${unknown.join(", ")} is not an option -- choose from ${allowed.join(", ")}.`,
      field,
    );
  }
  return selected;
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}
