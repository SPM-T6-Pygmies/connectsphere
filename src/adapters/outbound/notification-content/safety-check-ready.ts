import type { SafetyCheckReadyNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

const venueList = new Intl.ListFormat("en-SG", { style: "long", type: "conjunction" });

/**
 * The words a Safety Officer reads when an event joins their Awaiting check
 * list (SPM-262 AC5): which event, the venues it is confirmed at -- so a
 * booking that was rejected along the way is visibly not part of what is
 * checked -- whether it needs equipment, and when it runs.
 */
export function safetyCheckReadyMessage(notice: SafetyCheckReadyNotice): NotificationMessage {
  const equipment = notice.equipmentLines === 0 ? "No equipment needed." : "All equipment reserved.";
  const when =
    notice.preferredDate === null
      ? "No event date set yet."
      : `Event date: ${calendarDayFormat.format(new Date(`${notice.preferredDate}T00:00:00Z`))}.`;

  return {
    subject: `${notice.eventName} is ready for a safety check`,
    body: `Confirmed at ${venueList.format(notice.venues)}. ${equipment} ${when}`,
  };
}
