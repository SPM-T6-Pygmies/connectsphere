import { decideBooking, type BookingId, type BookingDecision } from "../domain/booking";
import { BookingNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { venueId } from "../domain/venue";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { BookingReviewRepository } from "../ports/outbound/booking-review-repository";

export type DecideBookingRequestCommand = {
  readonly bookingId: string;
  /** The Venue Staff member deciding. */
  readonly userAccountId: string;
} & (
  | { readonly decision: "approve" }
  | {
      readonly decision: "reject";
      readonly reason: string;
      /** The id of a venue to suggest instead, or null for no suggestion. */
      readonly suggestedAlternative: string | null;
    }
);

export interface DecideBookingRequestResult {
  readonly bookingId: string;
  readonly status: "Confirmed" | "Rejected";
  readonly venueLocation: string;
}

export interface DecideBookingRequestDeps {
  readonly reviews: BookingReviewRepository;
  readonly bookings: BookingRepository;
}

/**
 * SPM-22: Venue Staff approve or reject a booking request.
 *
 * A booking Venue Staff may not see is refused exactly like one that does not
 * exist (#91). Whether it can still be decided, whether an approval would
 * clash and whether a rejection has its reason are `decideBooking`'s calls --
 * this file gathers what it needs and records the outcome.
 */
export class DecideBookingRequestUseCase {
  constructor(private readonly deps: DecideBookingRequestDeps) {}

  async execute(command: DecideBookingRequestCommand): Promise<DecideBookingRequestResult> {
    const { reviews, bookings } = this.deps;
    const staff = userAccountId(command.userAccountId);

    const booking = await reviews.find(staff, command.bookingId as BookingId);
    if (booking === null) {
      throw new BookingNotFoundError(command.bookingId);
    }

    const dates = [...new Set(booking.slots.map(({ date }) => date))];
    const occupied = dates.length === 0 ? [] : await bookings.listSlotsAt(booking.venueId, dates);

    const decision: BookingDecision =
      command.decision === "approve"
        ? { kind: "approve" }
        : {
            kind: "reject",
            reason: command.reason,
            suggestedAlternative:
              command.suggestedAlternative === null ? null : venueId(command.suggestedAlternative),
          };

    const decided = decideBooking(booking, decision, staff, occupied);
    await reviews.decide(decided);

    return {
      bookingId: decided.id,
      status: decided.status,
      venueLocation: booking.venueLocation,
    };
  }
}
