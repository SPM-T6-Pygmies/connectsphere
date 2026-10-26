import type { VenueChangeFlag } from "@/core/domain/venue-change-flag";
import type { VenueId } from "@/core/domain/venue";
import type { ReviewedBooking, VenueChangeReview } from "@/core/ports/outbound/venue-change-review";

/** A flag as stored, open until a test clears it. */
export interface StoredVenueChangeFlag {
  readonly bookingId: string;
  readonly sourceRef: string;
  readonly detail: string;
  readonly cleared: boolean;
}

/** An array-backed store that obeys the same contract as the Supabase one. */
export class InMemoryVenueChangeReview implements VenueChangeReview {
  private rows: StoredVenueChangeFlag[] = [];

  constructor(private readonly bookings: ReadonlyMap<VenueId, readonly ReviewedBooking[]> = new Map()) {}

  async bookingsAt(venueId: VenueId): Promise<readonly ReviewedBooking[]> {
    return this.bookings.get(venueId) ?? [];
  }

  async flag(_venueId: VenueId, flags: readonly VenueChangeFlag[]): Promise<void> {
    for (const { bookingId, sourceRef, detail, startsFailing } of flags) {
      const open = this.rows.find((row) => !row.cleared && row.bookingId === bookingId && row.sourceRef === sourceRef);
      if (open !== undefined) {
        this.rows = this.rows.map((row) => (row === open ? { ...row, detail } : row));
      } else if (startsFailing) {
        this.rows.push({ bookingId, sourceRef, detail, cleared: false });
      }
    }
  }

  /** Test helper: every flag stored, cleared ones included. */
  all(): readonly StoredVenueChangeFlag[] {
    return this.rows;
  }

  /** Test helper: the coordinator cleared the booking's flags (SPM-310). */
  clear(bookingId: string): void {
    this.rows = this.rows.map((row) => (row.bookingId === bookingId ? { ...row, cleared: true } : row));
  }
}
