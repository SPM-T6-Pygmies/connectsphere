import type {
  BookingId,
  BookingRequest,
  OccupiedSlot,
  VenueId,
} from "@/core/domain/booking";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  BookingRepository,
  EventBookingSummary,
} from "@/core/ports/outbound/booking-repository";

/** A booking as stored: the event's list view plus what scoping and clashes need. */
export interface StoredBooking extends EventBookingSummary {
  readonly eventId: string;
  readonly venueId: string;
  readonly roomLayoutId: string | null;
  readonly requestedBy: string;
}

export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows: StoredBooking[];
  private nextId: number;

  constructor(
    seed: readonly StoredBooking[] = [],
    private readonly venueLocations: ReadonlyMap<string, string> = new Map(),
    private readonly layoutNames: ReadonlyMap<string, string> = new Map(),
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
      .map(({ id, venueLocation, roomLayoutName, status, slots, requestedAt }) => ({
        id,
        venueLocation,
        roomLayoutName,
        status,
        slots,
        requestedAt,
      }));
  }

  async submit(request: BookingRequest): Promise<BookingId> {
    const id = `booking-${this.nextId++}`;
    this.rows.push({
      id,
      eventId: request.eventId,
      venueId: request.venueId,
      venueLocation: this.venueLocations.get(request.venueId) ?? request.venueId,
      roomLayoutId: request.roomLayoutId,
      roomLayoutName:
        request.roomLayoutId === null ? null : (this.layoutNames.get(request.roomLayoutId) ?? null),
      status: request.status,
      slots: request.slots,
      requestedBy: request.requestedBy,
      requestedAt: "2026-09-28T00:00:00.000Z",
    });
    return id as BookingId;
  }

  /** Test helper: everything stored, submitted rows included. */
  all(): readonly StoredBooking[] {
    return this.rows;
  }
}
