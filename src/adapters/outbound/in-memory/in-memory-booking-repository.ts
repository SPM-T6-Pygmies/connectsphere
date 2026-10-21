import {
  bookingCancellable,
  type BookingId,
  type BookingRequest,
  type OccupiedSlot,
} from "@/core/domain/booking";
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  VenueSlotBlockedError,
} from "@/core/domain/errors";
import { slotsOverlapping } from "@/core/domain/slot-grid";
import type { UserAccountId } from "@/core/domain/user-account";
import { venueId, type VenueId } from "@/core/domain/venue";
import type { BlockedSlot } from "@/core/domain/venue-unavailability";
import type {
  BookingRepository,
  EventBookingSummary,
} from "@/core/ports/outbound/booking-repository";

/** A booking as stored: the event's list view plus what scoping and clashes need. */
export interface StoredBooking
  extends Omit<
    EventBookingSummary,
    "venueId" | "holdExpiresAt" | "rejectionNote" | "suggestedAlternative"
  > {
  readonly eventId: string;
  /** Absent reads as none, as for a booking that was never rejected. */
  readonly rejectionNote?: string | null;
  readonly suggestedAlternative?: EventBookingSummary["suggestedAlternative"];
  readonly venueId: string;
  readonly requestedBy: string;
  /** A Tentative Hold's expiry; absent reads as none set. */
  readonly holdExpiresAt?: Date | null;
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
          .map((slot) => ({
            ...slot,
            status: booking.status,
            holdExpiresAt: booking.holdExpiresAt ?? null,
          })),
      );
  }

  /** Not scoped by coordinator: the use cases check the event is theirs before asking. */
  async listForEvent(
    _coordinatorId: UserAccountId,
    eventId: string,
  ): Promise<readonly EventBookingSummary[]> {
    return this.rows
      .filter((booking) => booking.eventId === eventId)
      .map((booking) => ({
        id: booking.id,
        venueId: venueId(booking.venueId),
        venueLocation: booking.venueLocation,
        roomLayoutName: booking.roomLayoutName,
        status: booking.status,
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
        slots: booking.slots,
        requestedAt: booking.requestedAt,
        rejectionNote: booking.rejectionNote ?? null,
        suggestedAlternative: booking.suggestedAlternative ?? null,
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
    const refused = slotsOverlapping(request.slots, blocked);
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

  async cancel(_coordinatorId: UserAccountId, bookingId: string): Promise<void> {
    const index = this.rows.findIndex((booking) => booking.id === bookingId);
    if (index === -1) {
      throw new BookingNotFoundError(bookingId);
    }
    const booking = this.rows[index];
    if (!bookingCancellable(booking.status)) {
      throw new BookingNotCancellableError(booking.status);
    }
    this.rows[index] = { ...booking, status: "Released" };
  }

  /** Test helper: everything stored, submitted rows included. */
  all(): readonly StoredBooking[] {
    return this.rows;
  }
}
