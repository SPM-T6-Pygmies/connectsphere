import { isCalendarDate } from "./booking";
import { bookingWindow } from "./booking-review-flag";
import {
  InvalidBookingDateError,
  InvalidUnavailabilityReasonError,
  InvalidUnavailabilityTimeError,
  UnavailabilityAlreadyLiftedError,
  UnavailabilityEndsBeforeStartError,
  UnavailabilityInThePastError,
  UnavailabilityNoteNotAllowedError,
  UnavailabilityNoteTooLongError,
  UnavailabilityOutsideOpeningHoursError,
} from "./errors";
import { closedPeriods, formatOpeningHours, type OpeningWindow } from "./opening-hours";
import { slotCodesFor, type SlotCodeOnDate } from "./slot-grid";
import { END_OF_DAY, formatRange, fromMinutes, isOnGrid, toMinutes } from "./time-of-day";
import type { UserAccountId } from "./user-account";
import type { VenueId } from "./venue";
import type { BusyInterval } from "./venue-search";

/** `venue_unavailability_reason_chk`: the customer's five reasons (Week 7 C2). */
export const UNAVAILABILITY_REASONS = [
  "Maintenance",
  "Equipment failure",
  "Renovation",
  "Safety",
  "Other",
] as const;

export type UnavailabilityReason = (typeof UNAVAILABILITY_REASONS)[number];

/** SPM-21 AC8, as for SPM-41's technical requirements. */
export const UNAVAILABILITY_NOTE_MAX_LENGTH = 500;

/**
 * What Venue Staff enter. Dates are `YYYY-MM-DD`, the venue's local day (#36); times are
 * `HH:MM` on the 15-minute grid, `24:00` allowed as the end. The same times apply on every day.
 */
export interface NewVenueUnavailability {
  readonly venueId: VenueId;
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly reason: string;
  readonly note: string | null;
}

/**
 * A block as it is stored: the same 15-minute slots on every day from the start date to
 * the end date, one entry per date and slot, the way a booking's slots are. A block
 * recorded before SPM-321 may still hold AM, PM or Night; they mean the same hours.
 */
export interface VenueUnavailabilityBlock {
  readonly venueId: VenueId;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: UnavailabilityReason;
  /** Only ever set when the reason is Other. */
  readonly note: string | null;
  /** Sorted by date, then by time within the day. */
  readonly slots: readonly SlotCodeOnDate[];
}

export function isUnavailabilityReason(raw: string): raw is UnavailabilityReason {
  return (UNAVAILABILITY_REASONS as readonly string[]).includes(raw);
}

/** The calendar day `now` falls on in `timeZone`, as `YYYY-MM-DD`. */
function dayIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Every day from `start` to `end`, both included. Both must be real dates, `start` not after `end`. */
function daysFrom(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** The time of day `now` falls at in `timeZone`, in minutes after midnight. */
function minuteIn(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return part("hour") * 60 + part("minute");
}

/**
 * SPM-21, SPM-321: the only way to build a block. A block needs real dates with the start
 * no later than the end (AC4), times on the 15-minute grid with the end after the start
 * (AC3), time the venue is open for (AC3a), an end that is not already past, whose "today"
 * and "now" are the venue's own (AC5), one of the five reasons (AC6), and a note only under
 * Other (AC7) of at most 500 characters (AC8).
 *
 * `timeZone` is an IANA zone, e.g. `"Asia/Singapore"`: a block ending late
 * tonight is still current, and the server's or UTC's day would be wrong near
 * midnight.
 *
 * Whether the venue exists is not decided here: that needs the catalogue
 * (AC2), so it belongs to the use case, which passes the venue's `openingHours`.
 */
export function defineVenueUnavailability(params: {
  details: NewVenueUnavailability;
  openingHours: readonly OpeningWindow[];
  now: Date;
  timeZone: string;
}): VenueUnavailabilityBlock {
  const { details, openingHours, now, timeZone } = params;

  for (const date of [details.startDate, details.endDate]) {
    if (!isCalendarDate(date)) {
      throw new InvalidBookingDateError(date);
    }
  }
  if (details.startDate > details.endDate) {
    throw new UnavailabilityEndsBeforeStartError(details.startDate, details.endDate);
  }

  const start = gridTime(details.startTime);
  const end = gridTime(details.endTime);
  if (start === END_OF_DAY || end <= start) {
    throw new InvalidUnavailabilityTimeError(
      `The block must end after it starts: ${details.startTime.trim()} to ${details.endTime.trim()} does not.`,
    );
  }
  const range = { start, end };

  const closed = closedPeriods(openingHours, range);
  if (closed.length > 0) {
    throw new UnavailabilityOutsideOpeningHoursError(
      closed.map(formatRange),
      formatOpeningHours(openingHours),
    );
  }

  const today = dayIn(now, timeZone);
  if (
    details.endDate < today ||
    (details.endDate === today && end <= minuteIn(now, timeZone))
  ) {
    throw new UnavailabilityInThePastError(`${details.endDate} ${fromMinutes(end)}`);
  }

  if (!isUnavailabilityReason(details.reason)) {
    throw new InvalidUnavailabilityReasonError(details.reason);
  }

  const note = details.note?.trim() || null;
  if (note !== null) {
    if (details.reason !== "Other") {
      throw new UnavailabilityNoteNotAllowedError(details.reason);
    }
    if (Array.from(note).length > UNAVAILABILITY_NOTE_MAX_LENGTH) {
      throw new UnavailabilityNoteTooLongError(UNAVAILABILITY_NOTE_MAX_LENGTH);
    }
  }

  const codes = slotCodesFor(range);
  return {
    venueId: details.venueId,
    startDate: details.startDate,
    endDate: details.endDate,
    reason: details.reason,
    note,
    slots: daysFrom(details.startDate, details.endDate).flatMap((date) =>
      codes.map((slot) => ({ date, slot })),
    ),
  };
}

function gridTime(raw: string): number {
  const minutes = toMinutes(raw);
  if (minutes === null) {
    throw new InvalidUnavailabilityTimeError(
      `${raw.trim() || "A blank"} is not a time -- enter it as HH:MM, such as 09:00.`,
    );
  }
  if (!isOnGrid(minutes)) {
    throw new InvalidUnavailabilityTimeError(
      `${raw.trim()} is not on the 15-minute grid -- use :00, :15, :30 or :45.`,
    );
  }
  return minutes;
}

/**
 * SPM-321: whether `block` is the same as one already In force: same venue and reason, and exactly
 * the same days and times. A lifted block is history and does not count. Overlapping blocks that
 * differ in any of those are different blocks (SPM-21 AC19).
 *
 * `Other` is never a duplicate. Its note is free text that nothing here reads, so two Other blocks
 * can be for different things however alike they look; Venue Staff may record as many as they need.
 */
export function duplicatesInForceBlock(
  block: VenueUnavailabilityBlock,
  entries: readonly VenueUnavailabilityEntry[],
): boolean {
  if (block.reason === "Other") {
    return false;
  }
  const key = (slots: readonly SlotCodeOnDate[]) =>
    slots
      .map(({ date, slot }) => `${date}|${slot}`)
      .sort()
      .join(",");
  const wanted = key(block.slots);
  return entries.some(
    (entry) =>
      entry.status === "In force" &&
      entry.venueId === block.venueId &&
      entry.reason === block.reason &&
      key(entry.slots) === wanted,
  );
}

/** The zone a venue's own "today" is read in, as bookings' dates are (#36). */
export const VENUE_TIME_ZONE = "Asia/Singapore";

export type UnavailabilityStatus = "In force" | "Lifted";

/**
 * A block as the list shows it: what was recorded, and while it is In force or
 * after it was lifted, who did it and when. A block is never deleted (AC16).
 */
export interface VenueUnavailabilityEntry extends VenueUnavailabilityBlock {
  readonly id: string;
  readonly venueLocation: string;
  readonly status: UnavailabilityStatus;
  readonly recordedByName: string;
  /** ISO instant. */
  readonly recordedAt: string;
  readonly liftedByName: string | null;
  /** ISO instant. */
  readonly liftedAt: string | null;
}

/** A decided lift, for a store to record. */
export interface UnavailabilityLift {
  readonly id: string;
  readonly liftedBy: UserAccountId;
  readonly liftedAt: Date;
}

/** SPM-21 AC15, AC17: only a block still In force can be lifted. */
export function liftVenueUnavailability(
  entry: VenueUnavailabilityEntry,
  liftedBy: UserAccountId,
  now: Date,
): UnavailabilityLift {
  if (entry.status === "Lifted") {
    throw new UnavailabilityAlreadyLiftedError();
  }
  return { id: entry.id, liftedBy, liftedAt: now };
}

/** A slot of a venue that some In force block holds. */
export interface BlockedSlot extends SlotCodeOnDate {
  readonly venueId: VenueId;
}

/**
 * The slots some block still holds, each once per venue. A slot two In force
 * blocks cover stays blocked when one is lifted (AC15, AC19); a lifted block
 * holds nothing.
 */
export function slotsStillBlocked(entries: readonly VenueUnavailabilityEntry[]): readonly BlockedSlot[] {
  const seen = new Map<string, BlockedSlot>();
  for (const entry of entries) {
    if (entry.status !== "In force") {
      continue;
    }
    for (const { date, slot } of entry.slots) {
      seen.set(`${entry.venueId}|${date}|${slot}`, { venueId: entry.venueId, date, slot });
    }
  }
  return [...seen.values()];
}

/**
 * What venue search and the busy-time read treat as taken because of blocks: each
 * slot an In force block holds, as that slot's hours on its date. `venue_busy_intervals`
 * adds the same intervals in SQL (SPM-268, AC14).
 */
export function blockedBusyIntervals(entries: readonly VenueUnavailabilityEntry[]): readonly BusyInterval[] {
  return slotsStillBlocked(entries).map(({ venueId, date, slot }) => ({
    venueId,
    ...bookingWindow({ date, slot }),
  }));
}
