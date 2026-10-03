import type { Brand } from "./brand";
import {
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

/** The requested slots that an existing hold or confirmed booking already has. */
export function clashingSlots(
  requested: readonly SlotOnDate[],
  occupied: readonly OccupiedSlot[],
): SlotOnDate[] {
  const taken = new Set(occupied.filter((o) => holdsSlot(o.status)).map(slotKey));
  return requested.filter((slot) => taken.has(slotKey(slot)));
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

  const clashes = clashingSlots(input.slots, input.occupied);
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
