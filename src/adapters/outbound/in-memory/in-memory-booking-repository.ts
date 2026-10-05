import type { BookingId, BookingRequest, OccupiedSlot } from "@/core/domain/booking";
import {
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  VenueSlotBlockedError,
} from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import { venueId, type VenueId } from "@/core/domain/venue";
import type { BlockedSlot } from "@/core/domain/venue-unavailability";
import type {
  BookingRepository,
  EventBookingSummary,
} from "@/core/ports/outbound/booking-repository";

/** A booking as stored: the event's list view plus what scoping and clashes need. */
export interface StoredBooking extends Omit<EventBookingSummary, "venueId"> {
  readonly eventId: string;
  readonly venueId: string;
  readonly requestedBy: string;
}

/** Where the store learns which slots Venue Staff have blocked (SPM-21). */
export interface BlockedSlotSource {
  blockedSlots(): readonly BlockedSlot[];
}

export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows: StoredBooking[];
  private nextId: number;

  constructor(
    seed: readonly StoredBooking[] = [],
    private readonly venueLocations: ReadonlyMap<string, string> = new Map(),
    private readonly blocks: BlockedSlotSource = { blockedSlots: () => [] },
  ) {
    this.rows = [...seed];
    this.nextId = seed.length + 1;
  }

  async listSlotsAt(venue: VenueId, dates: readonly string[]): Promise<readonly OccupiedSlot[]> {
    return this.rows
      .filter((booking) => booking.venueId === venue)
      .flatMap((booking) =>
        booking.slots
          .filter((slot) => dates.includes(slot.date))
          .map((slot) => ({ ...slot, status: booking.status })),
      );
  }

  /** Not scoped by coordinator: the use cases check the event is theirs before asking. */
  async listForEvent(
    _coordinatorId: UserAccountId,
    eventId: string,
  ): Promise<readonly EventBookingSummary[]> {
    return this.rows
      .filter((booking) => booking.eventId === eventId)
      .map(({ id, venueId: venue, venueLocation, roomLayoutName, status, slots, requestedAt }) => ({
        id,
        venueId: venueId(venue),
        venueLocation,
        roomLayoutName,
        status,
        slots,
        requestedAt,
      }));
  }

  /**
   * Refuses a slot an In force block covers, as the `booking_slot` trigger does
   * (SPM-21 AC12), whatever the use case checked first.
   */
  async submit(request: BookingRequest): Promise<BookingId> {
    const blocked = this.blocks
      .blockedSlots()
      .filter((slot) => slot.venueId === request.venueId);
    const refused = request.slots.filter(({ date, slot }) =>
      blocked.some((b) => b.date === date && b.slot === slot),
    );
    if (refused.length > 0) {
      throw new VenueSlotBlockedError(refused);
    }

    const id = `booking-${this.nextId++}`;
    this.rows.push({
      id,
      eventId: request.eventId,
      venueId: request.venueId,
      venueLocation: this.venueLocations.get(request.venueId) ?? request.venueId,
      roomLayoutName: request.roomLayout,
      status: request.status,
      slots: request.slots,
      requestedBy: request.requestedBy,
      requestedAt: "2026-09-28T00:00:00.000Z",
    });
    return id as BookingId;
  }

  async changeRoomLayout(
    _coordinatorId: UserAccountId,
    bookingId: string,
    roomLayout: string | null,
  ): Promise<void> {
    const index = this.rows.findIndex((booking) => booking.id === bookingId);
    if (index === -1) {
      throw new BookingNotFoundError(bookingId);
    }
    const booking = this.rows[index];
    if (booking.status !== "Requested") {
      throw new BookingRoomLayoutNotChangeableError(booking.status);
    }
    this.rows[index] = { ...booking, roomLayoutName: roomLayout };
  }

  /** Test helper: everything stored, submitted rows included. */
  all(): readonly StoredBooking[] {
    return this.rows;
  }
}
