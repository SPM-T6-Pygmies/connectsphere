import type { VenueBookingDecidedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { slotDays } from "./venue-booking-requested";

/**
 * The words a coordinator reads when Venue Staff decide one of their booking
 * requests (SPM-62). Both outcomes name the venue, since an event can hold
 * several bookings (AC1). A rejection carries Venue Staff's reason and, only
 * if they gave one, the venue they suggested -- an informal suggestion that
 * books nothing, so it is worded as one (AC2, #45).
 */
export function venueBookingDecidedMessage(notice: VenueBookingDecidedNotice): NotificationMessage {
  if (notice.outcome === "Confirmed") {
    return {
      subject: `${notice.venueLocation} approved for ${notice.eventName}`,
      body: `Venue Staff confirmed ${notice.venueLocation} for ${slotDays(notice.slots)}. The venue is secured.`,
    };
  }

  const rejected = `Venue Staff rejected ${notice.venueLocation} for ${slotDays(notice.slots)}. Reason: ${notice.reason ?? "none given"}`;
  return {
    subject: `${notice.venueLocation} rejected for ${notice.eventName}`,
    body:
      notice.suggestedAlternativeLocation === null
        ? rejected
        : `${rejected} Suggested instead: ${notice.suggestedAlternativeLocation}. This is only a suggestion; send a new request to book it.`,
  };
}
