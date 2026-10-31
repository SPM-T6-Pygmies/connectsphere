import {
  blockedTimes,
  bookingCancellable,
  type BookingId,
  type BookingRequest,
  type OccupiedTime,
} from "@/core/domain/booking";
import { reRequestPending } from "@/core/domain/booking-review-flag";
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  ReRequestPendingError,
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
export interface StoredBooking
  extends Omit<
    EventBookingSummary,
    | "venueId"
    | "holdExpiresAt"
    | "rejectionNote"
    | "suggestedAlternative"
    | "replacesBookingId"
    | "replacedByBookingId"
  > {
  readonly eventId: string;
  /** Absent reads as none, as for a booking that was never rejected. */
  readonly rejectionNote?: string | null;
  readonly suggestedAlternative?: EventBookingSummary["suggestedAlternative"];
  readonly venueId: string;
  readonly requestedBy: string;
  /** A Tentative Hold's expiry; absent reads as none set. */
  readonly holdExpiresAt?: Date | null;
  /** SPM-251: absent reads as none, as for an ordinary request. */
  readonly replacesBookingId?: string | null;
  readonly replacedByBookingId?: string | null;
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

  async listSlotsAt(venue: VenueId, dates: readonly string[]): Promise<readonly OccupiedTime[]> {
    return this.rows
      .filter((booking) => booking.venueId === venue)
      .flatMap((booking) =>
        booking.times
          .filter((time) => dates.includes(time.date))
          .map((time) => ({
            ...time,
            bookingId: booking.id,
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
        times: booking.times,
        requestedAt: booking.requestedAt,
        rejectionNote: booking.rejectionNote ?? null,
        suggestedAlternative: booking.suggestedAlternative ?? null,
        replacesBookingId: booking.replacesBookingId ?? null,
        replacedByBookingId: booking.replacedByBookingId ?? null,
      }));
  }

  /**
   * Refuses a slot an In force block covers, as the `booking_slot` trigger does
   * (SPM-21 AC12), whatever the use case checked first. A second re-request for
   * a booking while one waits is refused too, as the database's index does
   * (SPM-251 AC9). Flags are not held here, so their check is the use case's.
   */
  async submit(request: BookingRequest): Promise<BookingId> {
    const refused = blockedTimes(
      request.times,
      this.blocks.blockedSlots().filter((slot) => slot.venueId === request.venueId),
    );
    if (refused.length > 0) {
      throw new VenueSlotBlockedError(refused);
    }
    if (
      request.replacesBookingId !== null &&
      reRequestPending(
        this.rows.map((row) => ({ status: row.status, replacesBookingId: row.replacesBookingId ?? null })),
        request.replacesBookingId,
      )
    ) {
      throw new ReRequestPendingError(request.replacesBookingId);
    }

    const id = `booking-${this.nextId++}`;
    this.rows.push({
      id,
      eventId: request.eventId,
      venueId: request.venueId,
      venueLocation: this.venueLocations.get(request.venueId) ?? request.venueId,
      roomLayoutName: request.roomLayout,
      status: request.status,
      times: request.times,
      requestedBy: request.requestedBy,
      requestedAt: "2026-09-28T00:00:00.000Z",
      replacesBookingId: request.replacesBookingId,
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
