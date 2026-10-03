import { clashingSlots, holdsSlot, type BookingId, type DecidedBooking } from "@/core/domain/booking";
import { BookingNotDecidableError, VenueSlotUnavailableError } from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  BookingForReview,
  BookingReviewRepository,
  BookingReviewSection,
} from "@/core/ports/outbound/booking-review-repository";

const SECTION_STATUSES: Readonly<Record<BookingReviewSection, readonly string[]>> = {
  requests: ["Requested"],
  decided: ["Tentative Hold", "Confirmed"],
  archive: ["Rejected", "Released", "Cancelled"],
};

/** Venue Staff's bookings held in memory, for tests and local wiring. */
export class InMemoryBookingReviewRepository implements BookingReviewRepository {
  private readonly rows: BookingForReview[];

  constructor(
    seed: readonly BookingForReview[] = [],
    /** Who counts as Venue Staff; anyone else sees nothing. */
    private readonly venueStaff: readonly string[] = [],
  ) {
    this.rows = [...seed];
  }

  async list(
    staff: UserAccountId,
    section: BookingReviewSection,
  ): Promise<readonly BookingForReview[]> {
    if (!this.venueStaff.includes(staff)) {
      return [];
    }
    return this.rows.filter((row) => SECTION_STATUSES[section].includes(row.status));
  }

  async find(staff: UserAccountId, id: BookingId): Promise<BookingForReview | null> {
    if (!this.venueStaff.includes(staff)) {
      return null;
    }
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async decide(decided: DecidedBooking): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === decided.id);
    const row = this.rows[index];
    if (row === undefined || row.status !== "Requested") {
      throw new BookingNotDecidableError();
    }

    if (decided.status === "Confirmed") {
      const held = this.rows
        .filter((other) => other.id !== row.id && other.venueId === row.venueId)
        .flatMap((other) =>
          holdsSlot(other.status)
            ? other.slots.map((slot) => ({ ...slot, status: other.status }))
            : [],
        );
      const clashes = clashingSlots(row.slots, held);
      if (clashes.length > 0) {
        throw new VenueSlotUnavailableError(clashes);
      }
    }

    this.rows[index] = {
      ...row,
      status: decided.status,
      rejectionNote: decided.rejectionNote,
      decidedByName: decided.decidedBy,
    };
  }

  /** Test helper: everything stored. */
  all(): readonly BookingForReview[] {
    return this.rows;
  }
}
