import type { EventRescheduledNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { timeDays } from "./venue-booking-requested";

/**
 * The words an Organiser reads when their event is rescheduled (SPM-68 AC2):
 * that it was, then every new date with its times. When the same decision
 * took it out of Confirmed it says so, since SPM-111 stays silent then.
 */
export function eventRescheduledMessage(notice: EventRescheduledNotice): NotificationMessage {
  return {
    subject: `${notice.eventName} is rescheduled`,
    body: [
      `${notice.eventName} has been rescheduled. New times: ${timeDays(notice.times)}.`,
      ...(notice.backToPlanning ? ["It is back in Planning until its arrangements are confirmed again."] : []),
    ].join(" "),
  };
}
