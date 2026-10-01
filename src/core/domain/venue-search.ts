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

/** When the event would run, as local wall-clock time at the venue. */
export interface VenueSearchWindow {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** `HH:MM`, 24-hour. */
  readonly start: string;
  readonly end: string;
}

/** A span during which a venue is held by a live booking. */
export interface BusyInterval {
  readonly venueId: VenueId;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface VenueSearchInput {
  readonly layout: string | null;
  readonly attendance: number | null;
  readonly facilities: readonly string[];
  readonly accessibility: readonly string[];
  readonly date: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The only way to obtain `VenueSearchCriteria`. Refuses a search that cannot be
 * answered: a date without both times (or times without a date), an end that
 * is not after the start, a date already past, or a value that is not an
 * option. `today` is `YYYY-MM-DD` at the venues.
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
  const start = blankToNull(input.startTime);
  const end = blankToNull(input.endTime);

  if (date === null && start === null && end === null) {
    return null;
  }
  if (date === null) {
    throw new InvalidVenueSearchError("Choose the event date.", "date");
  }
  if (start === null) {
    throw new InvalidVenueSearchError("Choose the start time.", "startTime");
  }
  if (end === null) {
    throw new InvalidVenueSearchError("Choose the end time.", "endTime");
  }
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new InvalidVenueSearchError("Enter the date as YYYY-MM-DD.", "date");
  }
  if (date < today) {
    throw new InvalidVenueSearchError("Choose a date from today onwards.", "date");
  }
  if (!TIME_OF_DAY.test(start)) {
    throw new InvalidVenueSearchError("Enter the start time as HH:MM.", "startTime");
  }
  if (!TIME_OF_DAY.test(end)) {
    throw new InvalidVenueSearchError("Enter the end time as HH:MM.", "endTime");
  }
  // Zero-padded HH:MM, so string order is time order.
  if (end <= start) {
    throw new InvalidVenueSearchError("End time must be later than the start time.", "endTime");
  }
  return { date, start, end };
}

/**
 * The venues that meet every criterion given, in the order the catalogue
 * listed them. An empty list is an answer, not an error.
 *
 * `busy` must cover the searched window; `timeZone` (IANA) is where the
 * venues' wall-clock times -- operating hours and the window -- are read.
 */
export function searchVenues(
  venues: readonly Venue[],
  criteria: VenueSearchCriteria,
  busy: readonly BusyInterval[],
  today: string,
  timeZone: string,
): Venue[] {
  return venues.filter(
    (venue) =>
      matchesAttributes(venue, criteria) &&
      (criteria.window === null ||
        isOpenFor(venue, criteria.window, busy, today, timeZone)),
  );
}

/**
 * Layout and attendance are tested on the same (venue, layout) pair (#112): a
 * venue whose Theatre seats 200 does not match "Boardroom for 100" because its
 * Boardroom seats 20. The venue-level `capacity` is never consulted (SPM-106).
 */
export function matchesAttributes(venue: Venue, criteria: VenueSearchCriteria): boolean {
  const { layout, attendance } = criteria;
  if (layout !== null || attendance !== null) {
    const fits = venue.layouts.some(
      (candidate) =>
        (layout === null || candidate.name === layout) &&
        (attendance === null || candidate.capacity >= attendance),
    );
    if (!fits) return false;
  }

  return (
    includesAll(venue.facilities, criteria.facilities) &&
    includesAll(venue.accessibility, criteria.accessibility)
  );
}

/**
 * Whether the venue could be booked for the whole window: inside its operating
 * hours, within its booking horizon, and not overlapping a live booking. A
 * venue missing the hours or horizon cannot be shown to be open, so it is not.
 */
export function isOpenFor(
  venue: Venue,
  window: VenueSearchWindow,
  busy: readonly BusyInterval[],
  today: string,
  timeZone: string,
): boolean {
  const { operatingHoursStart: opens, operatingHoursEnd: closes, bookingHorizonDays } = venue;
  if (opens === null || closes === null || bookingHorizonDays === null) {
    return false;
  }
  if (window.start < opens || window.end > closes) {
    return false;
  }
  if (daysBetween(today, window.date) > bookingHorizonDays) {
    return false;
  }

  const from = instantAt(window.date, window.start, timeZone).getTime();
  const to = instantAt(window.date, window.end, timeZone).getTime();
  // Half-open: a booking ending as the window starts leaves the venue free.
  return !busy.some(
    (interval) =>
      interval.venueId === venue.id &&
      interval.startsAt.getTime() < to &&
      interval.endsAt.getTime() > from,
  );
}

/** The instants the window spans, so a caller can fetch the bookings it needs. */
export function windowInstants(
  window: VenueSearchWindow,
  timeZone: string,
): { from: Date; to: Date } {
  return {
    from: instantAt(window.date, window.start, timeZone),
    to: instantAt(window.date, window.end, timeZone),
  };
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

/**
 * The instant that is `time` on `date` on a wall clock in `timeZone`. Reads the
 * zone's offset at that moment, which is exact for a zone without daylight
 * saving -- Singapore is the only one served (#36).
 */
function instantAt(date: string, time: string, timeZone: string): Date {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(asUtc));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallClock = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
  );
  return new Date(asUtc - (wallClock - asUtc));
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
