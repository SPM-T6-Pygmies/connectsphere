import type { BookingStatus } from "../domain/booking";
import { flagsToClear } from "../domain/booking-review-flag";
import { userAccountId } from "../domain/user-account";
import type { BookingFlagRepository } from "../ports/outbound/booking-flag-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

import { assignedEventDetails } from "./assigned-event";

export interface ClearBookingFlagCommand {
  readonly eventId: string;
  readonly bookingId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
}

export interface ClearBookingFlagResult {
  readonly bookingId: string;
  readonly venueLocation: string;
  /** Unchanged by clearing (AC1). */
  readonly status: BookingStatus;
  readonly reasonsCleared: number;
}

export interface ClearBookingFlagDeps {
  readonly events: CoordinatorEventRepository;
  readonly flags: BookingFlagRepository;
}

/**
 * SPM-310: the assigned Event Coordinator decides a flagged booking still fits and clears
 * its flag, so they need not re-request a venue that works. It is their call alone: no Venue
 * Staff approval is asked for (AC3). Anyone else is told the event does not exist (#91).
 * Which reasons go is `flagsToClear`'s call; the booking itself is not touched.
 */
export class ClearBookingFlagUseCase {
  constructor(private readonly deps: ClearBookingFlagDeps) {}

  async execute(command: ClearBookingFlagCommand): Promise<ClearBookingFlagResult> {
    const { events, flags } = this.deps;
    const coordinatorId = userAccountId(command.userAccountId);

    const event = await assignedEventDetails(events, command.eventId, coordinatorId);

    const clearing = flagsToClear(await flags.openForEvent(coordinatorId, event.id), command.bookingId);
    const [{ bookingId, venueLocation, status }] = clearing;
    await flags.clear(coordinatorId, bookingId);

    return { bookingId, venueLocation, status, reasonsCleared: clearing.length };
  }
}
