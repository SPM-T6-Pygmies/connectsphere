import {
  clashingTimes,
  holdsSlot,
  type BookingId,
  type DecidedBooking,
  type ResolvedHold,
} from "@/core/domain/booking";
import {
  BookingNotDecidableError,
  HoldNotLiveError,
  VenuePaddedClashError,
  VenueSlotUnavailableError,
} from "@/core/domain/errors";
import { paddedClashes, type Buffers } from "@/core/domain/padded-window";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  BookingForReview,
  BookingReviewRepository,
  BookingReviewSection,
} from "@/core/ports/outbound/booking-review-repository";

const SECTION_STATUSES: Readonly<Record<BookingReviewSection, readonly string[]>> = {
  requests: ["Requested"],
  decided: ["Tentative Hold", "Confirmed"],
  archive: ["Rejected", "Released", "Cancelled", "Expired"],
};

/** Venue Staff's bookings held in memory, for tests and local wiring. */
export class InMemoryBookingReviewRepository implements BookingReviewRepository {
  private readonly rows: BookingForReview[];

  constructor(
    seed: readonly BookingForReview[] = [],
    /** Who counts as Venue Staff; anyone else sees nothing. */
    private readonly venueStaff: readonly string[] = [],
    /** Venue names by id, so a suggested alternative reads back by name, as the store's does. */
    private readonly venueNames: Readonly<Record<string, string>> = {},
    /** Each venue's setup and turnaround in minutes by id (SPM-23); a venue left out has none. */
    private readonly venueBuffers: Readonly<Record<string, Buffers>> = {},
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

    if (decided.status === "Confirmed" || decided.status === "Tentative Hold") {
      // Both keep the slots from now on. Review rows carry no hold expiry, so a
      // hold here counts as live, as one with no expiry does.
      const held = this.rows
        .filter((other) => other.id !== row.id && other.venueId === row.venueId)
        .flatMap((other) =>
          other.times.map((time) => ({ ...time, status: other.status, holdExpiresAt: null })),
        );
      const clashes = clashingTimes(row.times, held, new Date());
      if (clashes.length > 0) {
        throw new VenueSlotUnavailableError(clashes);
      }

      // SPM-19: the same times padded with the venue's setup and turnaround, against the
      // padded times of every booking that holds the venue (a hold is padded too).
      const inTheWay = this.rows
        .filter(
          (other) =>
            other.id !== row.id &&
            other.venueId === row.venueId &&
            holdsSlot({ status: other.status, holdExpiresAt: null }, new Date()),
        )
        .map((other) => ({ eventName: other.event.name, times: other.times }));
      const padded = paddedClashes(row.times, inTheWay, this.venueBuffers[row.venueId] ?? { setup: 0, turnaround: 0 });
      if (padded.length > 0) {
        throw new VenuePaddedClashError(padded);
      }
    }

    this.rows[index] = {
      ...row,
      status: decided.status,
      rejectionNote: decided.rejectionNote,
      suggestedAlternativeLocation:
        decided.suggestedAlternative === null ? null : (this.venueNames[decided.suggestedAlternative] ?? null),
      decidedByName: decided.decidedBy,
    };
  }

  /** Checks the status only: review rows carry the expiry, but a test pins it with the clock. */
  async resolveHold(resolved: ResolvedHold): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === resolved.id);
    const row = this.rows[index];
    if (row === undefined || row.status !== "Tentative Hold") {
      throw new HoldNotLiveError();
    }

    this.rows[index] = {
      ...row,
      status: resolved.status,
      holdExpiresAt: resolved.status === "Confirmed" ? null : row.holdExpiresAt,
      decidedByName: resolved.resolvedBy,
    };
  }

  /** Test helper: everything stored. */
  all(): readonly BookingForReview[] {
    return this.rows;
  }
}
