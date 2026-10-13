import {
  decideBooking,
  type BookingDecision,
  type BookingId,
} from "../domain/booking";
import { BookingNotFoundError } from "../domain/errors";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import { venueId } from "../domain/venue";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type {
  BookingForReview,
  BookingReviewRepository,
} from "../ports/outbound/booking-review-repository";
import type { Clock } from "../ports/outbound/clock";
import type { Notifier } from "../ports/outbound/notifier";
import type { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";

export type DecideBookingRequestCommand = {
  readonly bookingId: string;
  /** The Venue Staff member deciding. */
  readonly userAccountId: string;
} & (
  | { readonly decision: "approve" }
  | { readonly decision: "hold" }
  | {
      readonly decision: "reject";
      readonly reason: string;
      /** The id of a venue to suggest instead, or null for no suggestion. */
      readonly suggestedAlternative: string | null;
    }
);

export interface DecideBookingRequestResult {
  readonly bookingId: string;
  readonly status: "Confirmed" | "Rejected" | "Tentative Hold";
  readonly venueLocation: string;
  /** Only on a hold: when it lapses, as an ISO instant. */
  readonly holdExpiresAt?: string;
}

export interface DecideBookingRequestDeps {
  readonly reviews: BookingReviewRepository;
  readonly bookings: BookingRepository;
  readonly safetyCheck: Pick<SafetyCheckEntryAnnouncer, "around">;
  readonly clock: Clock;
  readonly notifier: Pick<Notifier, "venueBookingDecided">;
}

/**
 * SPM-22: Venue Staff approve or reject a booking request. SPM-218: or hold it
 * while the coordinator finalises the event.
 *
 * A booking Venue Staff may not see is refused exactly like one that does not
 * exist (#91). Whether it can still be decided, whether an approval would
 * clash and whether a rejection has its reason are `decideBooking`'s calls --
 * this file gathers what it needs and records the outcome.
 *
 * SPM-62: then it tells the event's assigned coordinator, if it has one. The
 * decision is stored first, so a notice that fails to send cannot undo it;
 * composition's notifier records a failure rather than throwing.
 */
export class DecideBookingRequestUseCase {
  constructor(private readonly deps: DecideBookingRequestDeps) {}

  async execute(command: DecideBookingRequestCommand): Promise<DecideBookingRequestResult> {
    // SPM-262 AC1: approving or rejecting a booking can leave the event's
    // venue bookings all Confirmed.
    return this.deps.safetyCheck.around({ bookingId: command.bookingId as BookingId }, () =>
      this.decide(command),
    );
  }

  private async decide(command: DecideBookingRequestCommand): Promise<DecideBookingRequestResult> {
    const { reviews, bookings, clock } = this.deps;
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
        : command.decision === "hold"
          ? { kind: "hold" }
          : {
              kind: "reject",
              reason: command.reason,
              suggestedAlternative:
                command.suggestedAlternative === null ? null : venueId(command.suggestedAlternative),
            };

    const decided = decideBooking(booking, decision, staff, occupied, clock.now());
    await reviews.decide(decided);
    // A hold is not an answer to the request, so the coordinator is told nothing yet: they
    // see "On hold until …" on the booking, and confirming or releasing it is SPM-219.
    if (decided.status !== "Tentative Hold") {
      await this.tellCoordinator(staff, booking, decided.status);
    }

    return {
      bookingId: decided.id,
      status: decided.status,
      venueLocation: booking.venueLocation,
      ...(decided.holdExpiresAt === undefined
        ? {}
        : { holdExpiresAt: decided.holdExpiresAt.toISOString() }),
    };
  }

  /**
   * Reads the booking back as stored, so the notice carries the reason and
   * the suggested venue's name exactly as the coordinator will find them.
   */
  private async tellCoordinator(
    staff: UserAccountId,
    before: BookingForReview,
    outcome: "Confirmed" | "Rejected",
  ): Promise<void> {
    const recipient = before.event.coordinatorUserAccountId;
    if (recipient === null) {
      return;
    }
    const after = (await this.deps.reviews.find(staff, before.id)) ?? before;

    await this.deps.notifier.venueBookingDecided({
      recipientUserAccountId: recipient,
      bookingId: after.id,
      eventId: after.event.id,
      eventRequestId: after.event.requestId,
      eventName: after.event.name,
      venueLocation: after.venueLocation,
      slots: after.slots,
      outcome,
      reason: after.rejectionNote,
      suggestedAlternativeLocation: after.suggestedAlternativeLocation,
    });
  }
}
