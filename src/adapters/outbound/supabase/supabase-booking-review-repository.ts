import { clashingSlots, type BookingId, type DecidedBooking } from "@/core/domain/booking";
import {
  BookingNotDecidableError,
  BookingNotFoundError,
  DecisionReasonRequiredError,
  VenueSlotUnavailableError,
} from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type {
  BookingForReview,
  BookingReviewRepository,
  BookingReviewSection,
} from "@/core/ports/outbound/booking-review-repository";

import {
  toBookingForReview,
  toDecideBookingArgs,
  type BookingReviewRow,
} from "./booking-review-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import { SupabaseBookingRepository } from "./supabase-booking-repository";

// SQLSTATEs raised by venue_staff_decide_booking (see its migration).
const NOT_FOUND = "CS030";
const NOT_DECIDABLE = "CS031";
const REASON_REQUIRED = "CS032";
const SLOT_TAKEN = "CS025";

/**
 * Reached through `security definer` functions, not the tables: `booking`
 * and `booking_slot` have RLS enabled with no policies. The functions answer
 * only for an account holding the Venue Staff role.
 */
export class SupabaseBookingReviewRepository implements BookingReviewRepository {
  private readonly bookings: SupabaseBookingRepository;

  constructor(private readonly client: SupabaseServerClient) {
    this.bookings = new SupabaseBookingRepository(client);
  }

  async list(
    staff: UserAccountId,
    section: BookingReviewSection,
  ): Promise<readonly BookingForReview[]> {
    return this.read(staff, section, null);
  }

  async find(staff: UserAccountId, id: BookingId): Promise<BookingForReview | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }
    // Any section: the page opens a booking whatever its status.
    const [booking] = await this.read(staff, "all", key);
    return booking ?? null;
  }

  /**
   * The function re-checks the role, that the booking is still waiting and
   * that no slot is held, under a lock on the venue, and writes the audit
   * record in the same transaction. Its SQLSTATEs come back as the domain's
   * own errors, so losing a race reads exactly like finding the booking
   * already decided.
   */
  async decide(decided: DecidedBooking): Promise<void> {
    const args = toDecideBookingArgs(decided);
    if (args === null) {
      throw new BookingNotFoundError(decided.id);
    }

    const { error } = await this.client.rpc("venue_staff_decide_booking", args);
    if (!error) {
      return;
    }

    switch (error.code) {
      case NOT_FOUND:
        throw new BookingNotFoundError(decided.id);
      case NOT_DECIDABLE:
        throw new BookingNotDecidableError();
      case REASON_REQUIRED:
        throw new DecisionReasonRequiredError();
      case SLOT_TAKEN:
        throw new VenueSlotUnavailableError(await this.takenBy(decided));
      default:
        throw new Error(`Failed to decide the booking: ${error.message}`, { cause: error });
    }
  }

  private async read(
    staff: UserAccountId,
    section: BookingReviewSection | "all",
    bookingId: number | null,
  ): Promise<readonly BookingForReview[]> {
    const key = toKey(staff);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("venue_staff_bookings", {
      p_staff_user_account_id: key,
      p_section: section,
      ...(bookingId === null ? {} : { p_booking_id: bookingId }),
    });
    if (error) {
      throw new Error(`Failed to read booking requests: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as BookingReviewRow[]).map(toBookingForReview);
  }

  /** Which of the booking's slots were taken, for a message that names them. */
  private async takenBy(decided: DecidedBooking) {
    const booking = await this.find(decided.decidedBy, decided.id);
    if (booking === null) {
      return [];
    }
    const occupied = await this.bookings.listSlotsAt(
      venueId(booking.venueId),
      [...new Set(booking.slots.map(({ date }) => date))],
    );
    return clashingSlots(booking.slots, occupied, new Date());
  }
}
