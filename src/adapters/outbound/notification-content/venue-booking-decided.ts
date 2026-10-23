import type { VenueBookingDecidedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { timeDays } from "./venue-booking-requested";

/**
 * The words a coordinator reads when Venue Staff decide one of their booking
 * requests (SPM-62), or release a hold on one (SPM-219). Every outcome names
 * the venue, since an event can hold several bookings (AC1). A rejection carries Venue Staff's reason and, only
 * if they gave one, the venue they suggested -- an informal suggestion that
 * books nothing, so it is worded as one (AC2, #45).
 */
export function venueBookingDecidedMessage(notice: VenueBookingDecidedNotice): NotificationMessage {
  if (notice.outcome === "Confirmed") {
    return {
      subject: `${notice.venueLocation} approved for ${notice.eventName}`,
      body: `Venue Staff confirmed ${notice.venueLocation} for ${timeDays(notice.times)}. The venue is secured.`,
    };
  }

  if (notice.outcome === "Released") {
    return {
      subject: `${notice.venueLocation} hold released for ${notice.eventName}`,
      body: `Venue Staff released the hold on ${notice.venueLocation} for ${timeDays(notice.times)}. The times are free for other events; send a new request if you still need them.`,
    };
  }

  const rejected = `Venue Staff rejected ${notice.venueLocation} for ${timeDays(notice.times)}. Reason: ${notice.reason ?? "none given"}`;
  return {
    subject: `${notice.venueLocation} rejected for ${notice.eventName}`,
    body:
      notice.suggestedAlternativeLocation === null
        ? rejected
        : `${rejected} Suggested instead: ${notice.suggestedAlternativeLocation}. This is only a suggestion; send a new request to book it.`,
  };
}
