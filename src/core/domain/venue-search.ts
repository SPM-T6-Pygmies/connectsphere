import { closedPeriods } from "./opening-hours";
import { InvalidVenueSearchError } from "./errors";
import { paddedSpan } from "./padded-window";
import { END_OF_DAY, fromMinutes, isOnGrid, toMinutes, type TimeRange } from "./time-of-day";
import { STANDARD_LAYOUTS, type Venue, type VenueId } from "./venue";
import { bufferMinutes, MAX_BUFFER_MINUTES } from "./venue-buffers";
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

/**
 * SPM-322: when the event would run -- a day at the venue, and a start and end
 * time on it, `HH:MM` on the 15-minute grid, Singapore time (#36). The end is
 * after the start and may be `24:00`; the window never crosses midnight.
 */
export interface VenueSearchWindow {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly start: string;
  readonly end: string;
}

/** A span during which a venue is held by a live booking or an In force block. */
export interface BusyInterval {
  readonly venueId: VenueId;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** A booking takes its venue's setup and turnaround too (SPM-250); a block does not. */
  readonly kind: "booking" | "block";
}

export interface VenueSearchInput {
  readonly layout: string | null;
  readonly attendance: number | null;
  readonly facilities: readonly string[];
  readonly accessibility: readonly string[];
  readonly date: string | null;
  readonly start: string | null;
  readonly end: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The only way to obtain `VenueSearchCriteria`. Refuses a search that cannot be
 * answered: a date without a start and end time (or times without a date), a
 * date already past, a time off the 15-minute grid or an end not after the
 * start (SPM-322 AC3), or a value that is not an option. `today` is
 * `YYYY-MM-DD` at the venues.
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
  const start = blankToNull(input.start);
  const end = blankToNull(input.end);

  if (date === null && start === null && end === null) {
    return null;
  }
  if (date === null) {
    throw new InvalidVenueSearchError("Choose the event date.", "date");
  }
  if (start === null) {
    throw new InvalidVenueSearchError("Choose a start time.", "start");
  }
  if (end === null) {
    throw new InvalidVenueSearchError("Choose an end time.", "end");
  }
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new InvalidVenueSearchError("Enter the date as YYYY-MM-DD.", "date");
  }
  if (date < today) {
    throw new InvalidVenueSearchError("Choose a date from today onwards.", "date");
  }

  const from = gridTime(start, "start");
  const to = gridTime(end, "end");
  if (from === END_OF_DAY) {
    throw new InvalidVenueSearchError("A search cannot start at 24:00.", "start");
  }
  // An end before the start is a range that crosses midnight, which no booking does.
  if (to <= from) {
    throw new InvalidVenueSearchError("The end time must be after the start time.", "end");
  }
  return { date, start: fromMinutes(from), end: fromMinutes(to) };
}

/** Minutes after midnight for a searched time, or a refusal naming what is wrong with it. */
function gridTime(raw: string, field: "start" | "end"): number {
  const minutes = toMinutes(raw);
  if (minutes === null) {
    throw new InvalidVenueSearchError(
      `${raw} is not a time -- enter it as HH:MM, such as 07:00.`,
      field,
    );
  }
  if (!isOnGrid(minutes)) {
    throw new InvalidVenueSearchError(
      `${raw} is not on the 15-minute grid -- use :00, :15, :30 or :45.`,
      field,
    );
  }
  return minutes;
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
  "closed",
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
 * `busy` must cover the searched window; `timeZone` (IANA) is where the
 * venues' wall-clock times -- the searched times on its date -- are read.
 */
export function searchVenues(
  venues: readonly Venue[],
  criteria: VenueSearchCriteria,
  busy: readonly BusyInterval[],
  today: string,
  timeZone: string,
): VenueSearchOutcome {
  const matched: Venue[] = [];
  const counts = new Map<ExclusionReason, number>();
  for (const venue of venues) {
    const reason =
      attributeMismatch(venue, criteria) ??
      (criteria.window === null
        ? null
        : unavailability(venue, criteria.window, busy, today, timeZone));
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
  busy: readonly BusyInterval[],
  today: string,
  timeZone: string,
): boolean {
  return unavailability(venue, window, busy, today, timeZone) === null;
}

/**
 * Whether the venue could be booked for the whole window searched: it is open
 * for all of it (SPM-320, SPM-322 AC1), the date is within its booking
 * horizon, and no live booking or In force block overlaps any of it. `busy`
 * holds both, whichever slot grid they are stored on. A venue missing its
 * opening hours or horizon cannot be shown to be open, so it is not.
 *
 * SPM-250: a booking is compared padded with this venue's own setup and
 * turnaround, and so is the window, as a request is on submit (SPM-23 AC6).
 * A block is compared with the window as searched: submitting refuses only a
 * block over the booked times themselves.
 */
function unavailability(
  venue: Venue,
  window: VenueSearchWindow,
  busy: readonly BusyInterval[],
  today: string,
  timeZone: string,
): ExclusionReason | null {
  const { openingHours, bookingHorizonDays } = venue;
  if (openingHours.length === 0 || bookingHorizonDays === null) {
    return "hoursUnknown";
  }
  if (closedPeriods(openingHours, windowRange(window)).length > 0) {
    return "closed";
  }
  if (daysBetween(today, window.date) > bookingHorizonDays) {
    return "beyondHorizon";
  }

  const { from, to } = windowInstants(window, timeZone);
  const buffers = bufferMinutes(venue);
  const searched = { startsAt: from, endsAt: to };
  const booked = busy.some(
    (interval) =>
      interval.venueId === venue.id &&
      (interval.kind === "block"
        ? overlaps(interval, searched)
        : overlaps(paddedSpan(interval, buffers), paddedSpan(searched, buffers))),
  );
  return booked ? "booked" : null;
}

/**
 * Half-open (SPM-322 AC2): a span ending as the other starts, or starting as
 * it ends, leaves the venue free.
 */
function overlaps(
  a: { readonly startsAt: Date; readonly endsAt: Date },
  b: { readonly startsAt: Date; readonly endsAt: Date },
): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && a.endsAt.getTime() > b.startsAt.getTime();
}

/**
 * The instants a search must read busy time for (SPM-250): the window, widened
 * on each side by the most setup and turnaround a venue can have, since the
 * window's padding and a booking's both reach out that far.
 */
export function busyTimeNeeded(
  window: VenueSearchWindow,
  timeZone: string,
): { from: Date; to: Date } {
  const { from, to } = windowInstants(window, timeZone);
  const reach = 2 * MAX_BUFFER_MINUTES * 60_000;
  return { from: new Date(from.getTime() - reach), to: new Date(to.getTime() + reach) };
}

/** The instants the searched window starts and ends. */
export function windowInstants(
  window: VenueSearchWindow,
  timeZone: string,
): { from: Date; to: Date } {
  return {
    from: instantAt(window.date, window.start, timeZone),
    to: instantAt(window.date, window.end, timeZone),
  };
}

/** The window as minutes after midnight. Assumes it came through `defineVenueSearch`. */
function windowRange(window: VenueSearchWindow): TimeRange {
  return { start: toMinutes(window.start) ?? 0, end: toMinutes(window.end) ?? 0 };
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
