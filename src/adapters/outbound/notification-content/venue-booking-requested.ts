import type { VenueBookingRequestedNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

const dayList = new Intl.ListFormat("en-SG", { style: "long", type: "conjunction" });

/**
 * The words Venue Staff read when a coordinator asks for a venue (SPM-61
 * AC2): the venue, and each date with the slots wanted on it. The slots
 * arrive sorted, so grouping keeps them in the order they fall.
 */
export function venueBookingRequestedMessage(
  notice: VenueBookingRequestedNotice,
): NotificationMessage {
  const byDate = new Map<string, string[]>();
  for (const { date, slot } of notice.slots) {
    byDate.set(date, [...(byDate.get(date) ?? []), slot]);
  }
  const when = [...byDate].map(
    ([date, slots]) =>
      `${calendarDayFormat.format(new Date(`${date}T00:00:00Z`))} (${slots.join(", ")})`,
  );

  return {
    subject: `${notice.venueLocation} requested for ${notice.eventName}`,
    body: `Requested for ${dayList.format(when)}. Approve or reject it.`,
  };
}
