import type { BookingId, DecidedBooking, ResolvedHold } from "@/core/domain/booking";
import {
  BookingNotDecidableError,
  BookingNotFoundError,
  DecisionReasonRequiredError,
  HoldNotLiveError,
  VenuePaddedClashError,
  VenueSlotBlockedError,
} from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  BookingForReview,
  BookingReviewRepository,
  BookingReviewSection,
} from "@/core/ports/outbound/booking-review-repository";

import {
  toBookingForReview,
  toDecideBookingArgs,
  toResolveHoldArgs,
  type BookingReviewRow,
} from "./booking-review-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import { expireLapsedHolds } from "./expire-lapsed-holds";
import { SupabaseBookingRepository } from "./supabase-booking-repository";

// SQLSTATEs raised by venue_staff_decide_booking (see its migration).
const NOT_FOUND = "CS030";
const NOT_DECIDABLE = "CS031";
const REASON_REQUIRED = "CS032";
// A Venue Staff block covers one of the booking's slots (SPM-22), the same
// code the booking_slot trigger raises for a request.
const SLOT_BLOCKED = "CS028";
// SPM-19: the booking's setup or turnaround time overlaps another live booking's. The clashes come as JSON in
// the error detail: `[{ event, date, start, end }]`.
const PADDED_CLASH = "CS082";
// SQLSTATE raised by venue_staff_resolve_hold (SPM-219): not a live hold. CS030 is its not-found,
// and CS028 (above) its refusal to confirm over a block.
const HOLD_NOT_LIVE = "CS074";

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
      case SLOT_BLOCKED:
        throw new VenueSlotBlockedError(await this.blockedBy(decided.id, decided.decidedBy, error.message));
      case PADDED_CLASH:
        throw new VenuePaddedClashError(toPaddedClashes(error.details));
      default:
        throw new Error(`Failed to decide the booking: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-219: the function re-checks the role and that the booking is still a
   * live hold, under a lock on the venue, and writes the audit record in the
   * same transaction. A hold that lapsed or was decided while the page was open
   * comes back as the domain's own error.
   */
  async resolveHold(resolved: ResolvedHold): Promise<void> {
    const args = toResolveHoldArgs(resolved);
    if (args === null) {
      throw new BookingNotFoundError(resolved.id);
    }

    const { error } = await this.client.rpc("venue_staff_resolve_hold", args);
    if (!error) {
      return;
    }

    switch (error.code) {
      case NOT_FOUND:
        throw new BookingNotFoundError(resolved.id);
      case HOLD_NOT_LIVE:
        throw new HoldNotLiveError();
      case SLOT_BLOCKED:
        // Confirming only: a block recorded after the hold still wins.
        throw new VenueSlotBlockedError(await this.blockedBy(resolved.id, resolved.resolvedBy, error.message));
      default:
        throw new Error(`Failed to resolve the hold: ${error.message}`, { cause: error });
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

    // SPM-253: a hold that ran out is marked Expired before it is listed.
    await expireLapsedHolds(this.client);
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

  /** Which of the booking's times are blocked, for a message that names them. */
  private async blockedBy(id: BookingId, staff: UserAccountId, refusal: string) {
    const booking = await this.find(staff, id);
    if (booking === null) {
      return [];
    }
    return this.bookings.blockedOf(booking.venueId, booking.times, refusal);
  }

  /** Which of the booking's times were taken, for a message that names them. */
}

/** The clashes the decide function names in its error detail (CS082). */
function toPaddedClashes(details: string | null | undefined) {
  const rows = JSON.parse(details ?? "[]") as ReadonlyArray<{
    event: string;
    date: string;
    start: string;
    end: string;
    /** Set when the booking in the way is a Tentative Hold: when it expires, or null. */
    holdExpiresAt?: string | null;
  }>;
  return rows.map(({ event, date, start, end, holdExpiresAt }) => ({
    eventName: event,
    date,
    start,
    end,
    hold: holdExpiresAt === undefined ? null : { expiresAt: holdExpiresAt },
  }));
}
