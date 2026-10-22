import type { ExpiredHoldNotices } from "../ports/outbound/expired-hold-notices";
import type { Notifier } from "../ports/outbound/notifier";

export interface NotifyExpiredHoldsDeps {
  readonly holds: ExpiredHoldNotices;
  readonly notifier: Pick<Notifier, "holdExpired">;
}

/**
 * SPM-254: tells each event's coordinator that a tentative hold on its venue
 * expired unconfirmed. There is no scheduler, so this runs after a staff page
 * renders, and a hold is announced on the first sweep after it lapses.
 * Claiming a hold marks it as announced, so each hold is announced once (AC3).
 */
export class NotifyExpiredHoldsUseCase {
  constructor(private readonly deps: NotifyExpiredHoldsDeps) {}

  async execute(): Promise<void> {
    for (const hold of await this.deps.holds.claim()) {
      // An event with no coordinator has nobody to tell, as with SPM-62.
      if (hold.coordinatorUserAccountId === null) {
        continue;
      }
      await this.deps.notifier.holdExpired({
        recipientUserAccountId: hold.coordinatorUserAccountId,
        bookingId: hold.bookingId,
        eventId: hold.eventId,
        eventRequestId: hold.eventRequestId,
        eventName: hold.eventName,
        venueLocation: hold.venueLocation,
        times: hold.times,
        holdExpiresAt: hold.holdExpiresAt,
      });
    }
  }
}
