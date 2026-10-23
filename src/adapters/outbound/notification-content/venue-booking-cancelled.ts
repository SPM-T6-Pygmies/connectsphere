import type { VenueBookingCancelledNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { timeDays } from "./venue-booking-requested";

/**
 * The words Venue Staff read when a coordinator cancels a confirmed booking
 * (SPM-63 AC3): the venue, each date with the times released, and that the
 * booking is now Released, so nobody prepares the venue for it.
 */
export function venueBookingCancelledMessage(
  notice: VenueBookingCancelledNotice,
): NotificationMessage {
  return {
    subject: `${notice.venueLocation} booking cancelled for ${notice.eventName}`,
    body: `The coordinator cancelled the confirmed booking of ${notice.venueLocation} for ${timeDays(notice.times)}. It is now Released, and that time is free to book again.`,
  };
}
