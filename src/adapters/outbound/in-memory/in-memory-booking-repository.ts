import type { Booking, BookingId, BookingStatus } from "@/core/domain/booking";
import { BookingNotFoundError } from "@/core/domain/errors";
import type { BookingRepository, NewBooking } from "@/core/ports/outbound/booking-repository";

/** A `Map`-backed store that obeys the same contract as the real one will. */
export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows = new Map<BookingId, Booking>();
  private sequence = 0;

  async add(booking: NewBooking): Promise<Booking> {
    this.sequence += 1;
    const stored: Booking = {
      id: `booking-${this.sequence}` as BookingId,
      status: "Requested",
      ...booking,
    };
    this.rows.set(stored.id, stored);
    return stored;
  }

  async find(id: BookingId): Promise<Booking | null> {
    return this.rows.get(id) ?? null;
  }

  async changeRoomLayout(id: BookingId, roomLayout: string): Promise<Booking> {
    const booking = this.rows.get(id);
    if (booking === undefined) {
      throw new BookingNotFoundError();
    }
    const changed: Booking = { ...booking, roomLayout };
    this.rows.set(id, changed);
    return changed;
  }

  /** Test helper: stands in for Venue Staff's decision, which SPM-46 will bring. */
  setStatus(id: BookingId, status: BookingStatus): void {
    const booking = this.rows.get(id);
    if (booking === undefined) {
      throw new BookingNotFoundError();
    }
    this.rows.set(id, { ...booking, status });
  }

  /** Test helper: everything stored. */
  all(): readonly Booking[] {
    return [...this.rows.values()];
  }
}
