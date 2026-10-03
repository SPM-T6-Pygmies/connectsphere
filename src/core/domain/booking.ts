import type { Brand } from "./brand";
import {
  BookingNotDecidableError,
  DecisionReasonRequiredError,
  InvalidBookingDateError,
  InvalidBookingTimeError,
  NoBookingSlotsError,
  OutsideOperatingHoursError,
  OverlappingBookingSlotsError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueSlotUnavailableError,
} from "./errors";
import type { UserAccountId } from "./user-account";
import type { Venue, VenueId } from "./venue";

/** Bookings are made on a 15-minute grid (#50). */
export const GRID_MINUTES = 15;

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** `HH:MM` as minutes since midnight; `24:00` is the end of the day. Null when not a time. */
export function toMinutes(time: string): number | null {
  if (!TIME.test(time)) {
    return null;
  }
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Whether a time falls on the 15-minute grid. */
export function isGridTime(time: string): boolean {
  const minutes = toMinutes(time);
  return minutes !== null && minutes % GRID_MINUTES === 0;
}

/**
 * Every grid time from `from` to `to`, inclusive, as `HH:MM` -- what a start or
 * end can be chosen from. `to` of `24:00` is the end of the day.
 */
export function gridTimes(from: string, to: string): string[] {
  const start = toMinutes(from);
  const end = toMinutes(to);
  if (start === null || end === null) {
    return [];
  }
  const times: string[] = [];
  for (
    let m = Math.ceil(start / GRID_MINUTES) * GRID_MINUTES;
    m <= end;
    m += GRID_MINUTES
  ) {
    times.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return times;
}

/** `booking_status_chk`. */
export type BookingStatus =
  | "Requested"
  | "Tentative Hold"
  | "Confirmed"
  | "Rejected"
  | "Released"
  | "Cancelled";

export type BookingId = Brand<string, "BookingId">;

/**
 * One stretch of time on one calendar day. `date` is `YYYY-MM-DD`, Singapore
 * time (#36); `start` and `end` are `HH:MM` on the 15-minute grid, start first.
 */
export interface SlotOnDate {
  readonly date: string;
  readonly start: string;
  readonly end: string;
}

/** A stretch of time some existing booking at the venue already sits on. */
export interface OccupiedSlot extends SlotOnDate {
  readonly status: BookingStatus;
}

/** A booking request as submitted, before Venue Staff have seen it. */
export interface BookingRequest {
  readonly eventId: string;
  readonly venueId: VenueId;
  /**
   * The name of a layout the venue supports -- layouts are matched by name, as
   * the catalogue keeps them (SPM-42). Null only when the venue has none.
   */
  readonly roomLayout: string | null;
  /** Sorted by date, then by slot within the day. */
  readonly slots: readonly SlotOnDate[];
  readonly requestedBy: UserAccountId;
  readonly status: "Requested";
}

/**
 * The statuses that keep a venue slot from anyone else: only one tentative
 * hold or confirmed booking per venue and slot (#41), and a clash is blocked
 * outright, not warned about (#35). A pending, rejected or released booking
 * holds nothing.
 *
 * Known gap (#123): the setup and turnaround buffer slots either side of a
 * booking are not counted yet -- only the booking's own slots are. The buffer
 * rules are still open on SPM-19.
 */
export function holdsSlot(status: BookingStatus): boolean {
  return status === "Confirmed" || status === "Tentative Hold";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, not just the right shape: 2026-02-30 is refused. */
function isCalendarDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) {
    return false;
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
  );
}

function compareSlots(a: SlotOnDate, b: SlotOnDate): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  return (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0);
}

/**
 * Whether two stretches of time share any time. Touching is not sharing: a
 * booking that ends at 11:00 does not clash with one that starts at 11:00.
 */
export function slotsOverlap(a: SlotOnDate, b: SlotOnDate): boolean {
  return (
    a.date === b.date &&
    (toMinutes(a.start) ?? 0) < (toMinutes(b.end) ?? 0) &&
    (toMinutes(b.start) ?? 0) < (toMinutes(a.end) ?? 0)
  );
}

/**
 * SPM-104: the layout a booking assumes, as a reference to one the venue
 * supports -- never free text. A choice is required only when there is one
 * to make: a venue with a single layout takes that layout, and one with none
 * on record has nothing to choose from.
 */
export function chooseRoomLayout(
  venue: Venue,
  requested: string | null,
): string | null {
  if (requested !== null) {
    if (!venue.layouts.some((layout) => layout.name === requested)) {
      throw new UnsupportedRoomLayoutError(requested);
    }
    return requested;
  }

  if (venue.layouts.length > 1) {
    throw new RoomLayoutRequiredError();
  }
  return venue.layouts[0]?.name ?? null;
}

/** The requested stretches that overlap one an existing hold or confirmed booking has. */
export function clashingSlots(
  requested: readonly SlotOnDate[],
  occupied: readonly OccupiedSlot[],
): SlotOnDate[] {
  const held = occupied.filter((o) => holdsSlot(o.status));
  return requested.filter((slot) =>
    held.some((other) => slotsOverlap(slot, other)),
  );
}

/**
 * A stretch must be a real start and end on the 15-minute grid, start before
 * end -- and, where the venue says when it operates, inside those hours. A venue
 * with no hours on record sets no bound.
 */
function checkTimes(slot: SlotOnDate, venue: Venue): void {
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  if (
    start === null ||
    end === null ||
    start % GRID_MINUTES !== 0 ||
    end % GRID_MINUTES !== 0 ||
    start >= end
  ) {
    throw new InvalidBookingTimeError(slot);
  }

  const opens =
    venue.operatingHoursStart === null
      ? null
      : toMinutes(venue.operatingHoursStart);
  const closes =
    venue.operatingHoursEnd === null
      ? null
      : toMinutes(venue.operatingHoursEnd);
  if (opens !== null && closes !== null && (start < opens || end > closes)) {
    throw new OutsideOperatingHoursError(
      slot,
      venue.operatingHoursStart ?? "",
      venue.operatingHoursEnd ?? "",
    );
  }
}

/**
 * SPM-46: an Event Coordinator asks Venue Staff for one venue, on one or more
 * slots across one or more days, for one event.
 *
 * `occupied` is what the venue already carries on the requested days. A clash
 * with a hold or confirmed booking refuses the request outright (#35, #41);
 * clashing with another pending request does not, because nothing is decided
 * yet.
 */
export function requestVenueBooking(input: {
  readonly eventId: string;
  readonly venue: Venue;
  readonly roomLayout: string | null;
  readonly slots: readonly SlotOnDate[];
  readonly requestedBy: UserAccountId;
  readonly occupied: readonly OccupiedSlot[];
}): BookingRequest {
  if (input.slots.length === 0) {
    throw new NoBookingSlotsError();
  }

  for (const slot of input.slots) {
    if (!isCalendarDate(slot.date)) {
      throw new InvalidBookingDateError(slot.date);
    }
    checkTimes(slot, input.venue);
  }

  const sorted = [...input.slots].sort(compareSlots);
  for (let i = 1; i < sorted.length; i += 1) {
    if (slotsOverlap(sorted[i - 1], sorted[i])) {
      throw new OverlappingBookingSlotsError(sorted[i].date);
    }
  }

  const roomLayout = chooseRoomLayout(input.venue, input.roomLayout);

  const clashes = clashingSlots(input.slots, input.occupied);
  if (clashes.length > 0) {
    throw new VenueSlotUnavailableError([...clashes].sort(compareSlots));
  }

  return {
    eventId: input.eventId,
    venueId: input.venue.id,
    roomLayout,
    slots: sorted,
    requestedBy: input.requestedBy,
    status: "Requested",
  };
}

/** A booking as Venue Staff decide it: what the decision rules need, nothing more. */
export interface BookingForDecision {
  readonly id: BookingId;
  readonly venueId: VenueId;
  readonly status: BookingStatus;
  readonly slots: readonly SlotOnDate[];
}

export type BookingDecision =
  | { readonly kind: "approve" }
  | {
      readonly kind: "reject";
      readonly reason: string;
      /** An informal suggestion, not a counter-offer (#45); it books nothing. */
      readonly suggestedAlternative: VenueId | null;
    };

/** The outcome of a decision, ready for the store to record. */
export interface DecidedBooking {
  readonly id: BookingId;
  readonly status: "Confirmed" | "Rejected";
  readonly decidedBy: UserAccountId;
  /** Null when approved. */
  readonly rejectionNote: string | null;
  readonly suggestedAlternative: VenueId | null;
}

/**
 * SPM-22: Venue Staff approve or reject a booking request.
 *
 * Approving confirms the booking, which holds its slots from then on, so it
 * meets the same hard block a request does (#35, #41): a slot another booking
 * already holds refuses the approval, however many requests asked for it.
 * `occupied` is what the venue carries on the booking's own days. Rejecting
 * must say why -- the reason is what the coordinator acts on -- and holds
 * nothing, so it needs no clash check.
 */
export function decideBooking(
  booking: BookingForDecision,
  decision: BookingDecision,
  decidedBy: UserAccountId,
  occupied: readonly OccupiedSlot[],
): DecidedBooking {
  if (booking.status !== "Requested") {
    throw new BookingNotDecidableError();
  }

  if (decision.kind === "approve") {
    const clashes = clashingSlots(booking.slots, occupied);
    if (clashes.length > 0) {
      throw new VenueSlotUnavailableError([...clashes].sort(compareSlots));
    }
    return {
      id: booking.id,
      status: "Confirmed",
      decidedBy,
      rejectionNote: null,
      suggestedAlternative: null,
    };
  }

  const reason = decision.reason.trim();
  if (reason.length === 0) {
    throw new DecisionReasonRequiredError();
  }
  return {
    id: booking.id,
    status: "Rejected",
    decidedBy,
    rejectionNote: reason,
    suggestedAlternative: decision.suggestedAlternative,
  };
}
