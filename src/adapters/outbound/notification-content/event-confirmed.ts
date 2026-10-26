import type { EventConfirmedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { timeDays } from "./venue-booking-requested";

/**
 * The words an Organiser reads when their event is confirmed (SPM-66): that it
 * is now Confirmed -- ConnectSphere is committed, unlike at Approved (#80) --
 * then when it runs, where, and the equipment reserved for it. An arrangement
 * not essential to the event never reaches the notice, so it is not mentioned.
 */
export function eventConfirmedMessage(notice: EventConfirmedNotice): NotificationMessage {
  const equipment = notice.equipment.map(
    ({ equipmentType, quantityReserved }) => `${quantityReserved} × ${equipmentType}`,
  );
  return {
    subject: `${notice.eventName} is confirmed`,
    body: [
      `${notice.eventName} is now Confirmed: ConnectSphere is committed to delivering it.`,
      ...(notice.times.length === 0 ? [] : [`When: ${timeDays(notice.times)}.`]),
      ...(notice.venueLocation === null ? [] : [`Venue: ${notice.venueLocation}.`]),
      ...(equipment.length === 0 ? [] : [`Equipment: ${equipment.join(", ")}.`]),
    ].join(" "),
  };
}
