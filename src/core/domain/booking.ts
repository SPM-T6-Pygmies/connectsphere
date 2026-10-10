import type { Brand } from "./brand";
import {
  BookingNotDecidableError,
  BookingRoomLayoutNotChangeableError,
  DecisionReasonRequiredError,
  DuplicateBookingSlotError,
  InvalidBookingDateError,
  NoBookingSlotsError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueSlotUnavailableError,
} from "./errors";
import type { UserAccountId } from "./user-account";
import type { Venue, VenueId } from "./venue";

/** `booking_slot_value_chk`: venues are booked in three fixed slots a day (#50). */
export type BookingSlot = "AM" | "PM" | "Night";

/** In the order they fall in a day, which is also the order a request is shown in. */
export const BOOKING_SLOTS: readonly BookingSlot[] = ["AM", "PM", "Night"];

/**
 * Each slot's span as `HH:MM` wall-clock time in Singapore, as the `slot` table
 * holds it. Night ends at midnight, written `24:00` so it falls after its start.
 */
export const SLOT_HOURS: Readonly<Record<BookingSlot, { start: string; end: string }>> = {
  AM: { start: "07:00", end: "12:00" },
  PM: { start: "13:00", end: "18:00" },
  Night: { start: "19:00", end: "24:00" },
};

/**
 * The instant `slot` starts on its date. Singapore observes no daylight
 * saving, so its +08:00 offset is exact (#36).
 */
export function slotStartsAt({ date, slot }: SlotOnDate): Date {
  return new Date(`${date}T${SLOT_HOURS[slot].start}:00+08:00`);
}

export function isBookingSlot(raw: string): raw is BookingSlot {
  return (BOOKING_SLOTS as readonly string[]).includes(raw);
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

/** One slot on one calendar day. `date` is `YYYY-MM-DD`, Singapore time (#36). */
export interface SlotOnDate {
  readonly date: string;
  readonly slot: BookingSlot;
}

/** A slot some existing booking at the venue already sits on. */
export interface OccupiedSlot extends SlotOnDate {
  readonly status: BookingStatus;
  /** When a Tentative Hold lapses; null when none is set, and for every other status. */
  readonly holdExpiresAt: Date | null;
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
 * Whether a booking keeps its slot from anyone else: only one tentative hold
 * or confirmed booking per venue and slot (#41), and a clash is blocked
 * outright, not warned about (#35). A pending, rejected or released booking
 * holds nothing.
 *
 * SPM-46 AC4: a Tentative Hold holds only until `holdExpiresAt`. A hold with
 * no expiry counts as live -- nothing creates one without an expiry until
 * SPM-218, so this errs towards keeping the slot. The database restates the
 * rule in `booking_holds_slot`.
 *
 * Known gap (#123): the setup and turnaround buffer slots either side of a
 * booking are not counted yet -- only the booking's own slots are. The buffer
 * rules are still open on SPM-19.
 */
export function holdsSlot(
  slot: Pick<OccupiedSlot, "status" | "holdExpiresAt">,
  now: Date,
): boolean {
  return (
    slot.status === "Confirmed" ||
    (slot.status === "Tentative Hold" &&
      (slot.holdExpiresAt === null || slot.holdExpiresAt > now))
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, not just the right shape: 2026-02-30 is refused. */
export function isCalendarDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) {
    return false;
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}

function slotKey({ date, slot }: SlotOnDate): string {
  return `${date}|${slot}`;
}

function compareSlots(a: SlotOnDate, b: SlotOnDate): number {
  return a.date === b.date
    ? BOOKING_SLOTS.indexOf(a.slot) - BOOKING_SLOTS.indexOf(b.slot)
    : a.date < b.date
      ? -1
      : 1;
}

/**
 * SPM-104: the layout a booking assumes, as a reference to one the venue
 * supports -- never free text. A choice is required only when there is one
 * to make: a venue with a single layout takes that layout, and one with none
 * on record has nothing to choose from.
 */
export function chooseRoomLayout(venue: Venue, requested: string | null): string | null {
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

/**
 * SPM-104: whether the event's expected attendance fits the layout a booking
 * assumes. Compared with that layout's own capacity -- never the venue-wide
 * figure, which says nothing about how the room is set up (SPM-106).
 *
 * `withinCapacity` is null when there is nothing to compare: no attendance
 * figure on the event yet, no layout on the booking, or a layout the venue no
 * longer lists (SPM-105). An answer of "unknown" never blocks a page.
 */
export interface LayoutCapacityCheck {
  readonly layout: string | null;
  readonly capacity: number | null;
  readonly expectedAttendance: number | null;
  readonly withinCapacity: boolean | null;
}

export function checkLayoutCapacity(
  venue: Venue,
  layout: string | null,
  expectedAttendance: number | null,
): LayoutCapacityCheck {
  const capacity =
    venue.layouts.find((candidate) => candidate.name === layout)?.capacity ??
    null;

  return {
    layout,
    capacity,
    expectedAttendance,
    withinCapacity:
      capacity === null || expectedAttendance === null
        ? null
        : expectedAttendance <= capacity,
  };
}

/**
 * SPM-104: the layout a pending booking is moved to. Only a request still
 * waiting for Venue Staff can change; the new layout is held to the same rule
 * as a first choice (`chooseRoomLayout`).
 */
export function chooseLayoutChange(
  booking: { readonly status: BookingStatus },
  venue: Venue,
  requested: string | null,
): string | null {
  if (booking.status !== "Requested") {
    throw new BookingRoomLayoutNotChangeableError(booking.status);
  }
  return chooseRoomLayout(venue, requested);
}

/** The requested slots that a live hold or confirmed booking already has at `now`. */
export function clashingSlots(
  requested: readonly SlotOnDate[],
  occupied: readonly OccupiedSlot[],
  now: Date,
): SlotOnDate[] {
  const taken = new Set(occupied.filter((o) => holdsSlot(o, now)).map(slotKey));
  return requested.filter((slot) => taken.has(slotKey(slot)));
}

/**
 * SPM-46: an Event Coordinator asks Venue Staff for one venue, on one or more
 * slots across one or more days, for one event.
 *
 * `occupied` is what the venue already carries on the requested days. A clash
 * with a live hold or confirmed booking refuses the request outright (#35,
 * #41); clashing with another pending request, or a hold that expired before
 * `now`, does not.
 */
export function requestVenueBooking(input: {
  readonly eventId: string;
  readonly venue: Venue;
  readonly roomLayout: string | null;
  readonly slots: readonly SlotOnDate[];
  readonly requestedBy: UserAccountId;
  readonly occupied: readonly OccupiedSlot[];
  readonly now: Date;
}): BookingRequest {
  if (input.slots.length === 0) {
    throw new NoBookingSlotsError();
  }

  const seen = new Set<string>();
  for (const slot of input.slots) {
    if (!isCalendarDate(slot.date)) {
      throw new InvalidBookingDateError(slot.date);
    }
    const key = slotKey(slot);
    if (seen.has(key)) {
      throw new DuplicateBookingSlotError(slot.date, slot.slot);
    }
    seen.add(key);
  }

  const roomLayout = chooseRoomLayout(input.venue, input.roomLayout);

  const clashes = clashingSlots(input.slots, input.occupied, input.now);
  if (clashes.length > 0) {
    throw new VenueSlotUnavailableError([...clashes].sort(compareSlots));
  }

  return {
    eventId: input.eventId,
    venueId: input.venue.id,
    roomLayout,
    slots: [...input.slots].sort(compareSlots),
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
  now: Date,
): DecidedBooking {
  if (booking.status !== "Requested") {
    throw new BookingNotDecidableError();
  }

  if (decision.kind === "approve") {
    const clashes = clashingSlots(booking.slots, occupied, now);
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
