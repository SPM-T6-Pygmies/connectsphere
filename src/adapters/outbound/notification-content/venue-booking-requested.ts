import type { SlotOnDate } from "@/core/domain/booking";
import type { VenueBookingRequestedNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

const dayList = new Intl.ListFormat("en-SG", { style: "long", type: "conjunction" });

/**
 * Each date with its slots, as "Fri, 20 Nov 2026 (AM, PM) and Sat, 21 Nov
 * 2026 (Night)". The slots arrive sorted, so grouping keeps them in the order
 * they fall.
 */
export function slotDays(slots: readonly SlotOnDate[]): string {
  const byDate = new Map<string, string[]>();
  for (const { date, slot } of slots) {
    byDate.set(date, [...(byDate.get(date) ?? []), slot]);
  }
  const when = [...byDate].map(
    ([date, daySlots]) =>
      `${calendarDayFormat.format(new Date(`${date}T00:00:00Z`))} (${daySlots.join(", ")})`,
  );
  return dayList.format(when);
}

/**
 * The words Venue Staff read when a coordinator asks for a venue (SPM-61
 * AC2): the venue, and each date with the slots wanted on it.
 */
export function venueBookingRequestedMessage(
  notice: VenueBookingRequestedNotice,
): NotificationMessage {
  return {
    subject: `${notice.venueLocation} requested for ${notice.eventName}`,
    body: `Requested for ${slotDays(notice.slots)}. Approve or reject it.`,
  };
}
