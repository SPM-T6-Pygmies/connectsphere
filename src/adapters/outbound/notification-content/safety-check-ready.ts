import type { SafetyCheckReadyNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

/**
 * The words a Safety Officer reads when an event joins their Awaiting check
 * list (SPM-262 AC5): which event, and when it runs.
 */
export function safetyCheckReadyMessage(notice: SafetyCheckReadyNotice): NotificationMessage {
  const when =
    notice.preferredDate === null
      ? "No event date set yet."
      : `Event date: ${calendarDayFormat.format(new Date(`${notice.preferredDate}T00:00:00Z`))}.`;

  return {
    subject: `${notice.eventName} is ready for a safety check`,
    body: `Its venue bookings are confirmed and its equipment is reserved. ${when}`,
  };
}
