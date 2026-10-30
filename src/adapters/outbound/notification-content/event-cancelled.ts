import type { EventCancelledNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";

/**
 * The words an Organiser reads when their event is cancelled (SPM-68 AC3).
 * Cancelling releases every booking and hold in the same transaction, and a
 * Cancelled event's equipment no longer counts against anyone (SPM-55), so
 * this holds whatever the event had.
 */
export function eventCancelledMessage(notice: EventCancelledNotice): NotificationMessage {
  return {
    subject: `${notice.eventName} is cancelled`,
    body: `${notice.eventName} has been cancelled. Its venue bookings and equipment reservations have been released.`,
  };
}
