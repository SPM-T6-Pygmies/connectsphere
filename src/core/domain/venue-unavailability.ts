import { BOOKING_SLOTS, isCalendarDate, type BookingSlot, type SlotOnDate } from "./booking";
import {
  InvalidBookingDateError,
  InvalidUnavailabilityReasonError,
  NoUnavailabilitySlotsError,
  UnavailabilityAlreadyLiftedError,
  UnavailabilityEndsBeforeStartError,
  UnavailabilityInThePastError,
  UnavailabilityNoteNotAllowedError,
  UnavailabilityNoteTooLongError,
} from "./errors";
import type { UserAccountId } from "./user-account";
import type { VenueId } from "./venue";

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

/** What Venue Staff enter. Dates are `YYYY-MM-DD`, the venue's local day (#36). */
export interface NewVenueUnavailability {
  readonly venueId: VenueId;
  readonly startDate: string;
  readonly endDate: string;
  readonly slots: readonly BookingSlot[];
  readonly reason: string;
  readonly note: string | null;
}

/**
 * A block as it is stored: the same slots on every day from the start date to
 * the end date, one entry per date and slot, the way a booking's slots are.
 */
export interface VenueUnavailabilityBlock {
  readonly venueId: VenueId;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: UnavailabilityReason;
  /** Only ever set when the reason is Other. */
  readonly note: string | null;
  /** Sorted by date, then by slot within the day. */
  readonly slots: readonly SlotOnDate[];
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

/**
 * SPM-21: the only way to build a block. A block needs at least one slot (AC3),
 * real dates with the start no later than the end (AC4), an end that is not
 * already past, whose "today" is the venue's own (AC5), one of the five reasons
 * (AC6), and a note only under Other (AC7) of at most 500 characters (AC8).
 *
 * `timeZone` is an IANA zone, e.g. `"Asia/Singapore"`: a block ending late
 * tonight is still current, and the server's or UTC's day would be wrong near
 * midnight.
 *
 * Whether the venue exists is not decided here: that needs the catalogue
 * (AC2), so it belongs to the use case.
 */
export function defineVenueUnavailability(params: {
  details: NewVenueUnavailability;
  now: Date;
  timeZone: string;
}): VenueUnavailabilityBlock {
  const { details, now, timeZone } = params;

  const slots = BOOKING_SLOTS.filter((slot) => details.slots.includes(slot));
  if (slots.length === 0) {
    throw new NoUnavailabilitySlotsError();
  }

  for (const date of [details.startDate, details.endDate]) {
    if (!isCalendarDate(date)) {
      throw new InvalidBookingDateError(date);
    }
  }
  if (details.startDate > details.endDate) {
    throw new UnavailabilityEndsBeforeStartError(details.startDate, details.endDate);
  }
  if (details.endDate < dayIn(now, timeZone)) {
    throw new UnavailabilityInThePastError(details.endDate);
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

  return {
    venueId: details.venueId,
    startDate: details.startDate,
    endDate: details.endDate,
    reason: details.reason,
    note,
    slots: daysFrom(details.startDate, details.endDate).flatMap((date) =>
      slots.map((slot) => ({ date, slot })),
    ),
  };
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
export interface BlockedSlot extends SlotOnDate {
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
