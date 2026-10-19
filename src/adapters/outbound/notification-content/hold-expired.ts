import type { HoldExpiredNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { slotDays } from "./venue-booking-requested";

/** "Sun, 8 Nov, 1:00 pm", in Singapore time, as both booking pages show a hold's expiry (SPM-218). */
const expiryFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * The words a coordinator reads when a tentative hold on their event's venue
 * expires unconfirmed (SPM-254). Names the venue, the held slots and when the
 * hold lapsed, and says the venue is no longer held (AC1, AC2).
 */
export function holdExpiredMessage(notice: HoldExpiredNotice): NotificationMessage {
  return {
    subject: `${notice.venueLocation} hold expired for ${notice.eventName}`,
    body: `The hold on ${notice.venueLocation} for ${slotDays(notice.slots)} expired at ${expiryFormat.format(new Date(notice.holdExpiresAt))} without being confirmed. The venue is no longer held; send a new request if you still need it.`,
  };
}
