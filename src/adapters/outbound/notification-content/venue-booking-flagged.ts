import type { VenueBookingFlaggedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";

/** As the event page's Flagged for review labels them (SPM-313, SPM-105). */
const REASON_LABELS: Readonly<Record<VenueBookingFlaggedNotice["reasonCode"], string>> = {
  "venue-unavailable": "Venue unavailable",
  "venue-attributes": "Venue changed",
};

/**
 * The words a coordinator reads when a change to a venue flags one of their
 * bookings (SPM-71): the event, the venue and each reason, as the event page
 * shows them (AC3), and that nothing was done to the booking (AC5).
 */
export function venueBookingFlaggedMessage(notice: VenueBookingFlaggedNotice): NotificationMessage {
  return {
    subject: `${notice.venueLocation} booking flagged for ${notice.eventName}`,
    body: `Your booking of ${notice.venueLocation} for ${notice.eventName} is flagged for review. ${REASON_LABELS[notice.reasonCode]}: ${notice.reasons.join("; ")}. Nothing has been cancelled or rebooked; open the event's Venue tab to decide what to do.`,
  };
}
