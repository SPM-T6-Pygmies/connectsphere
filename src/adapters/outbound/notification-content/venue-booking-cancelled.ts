import { SLOT_HOURS, type SlotOnDate } from "@/core/domain/booking";
import type { VenueBookingCancelledNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

const dayList = new Intl.ListFormat("en-SG", { style: "long", type: "conjunction" });

/**
 * Each date with the times released on it, as "Fri, 20 Nov 2026 (07:00–12:00,
 * 19:00–24:00)". Times rather than slot names, as the Week 7 change asks. The
 * slots arrive sorted, so grouping keeps them in the order they fall.
 */
function releasedTimes(slots: readonly SlotOnDate[]): string {
  const byDate = new Map<string, string[]>();
  for (const { date, slot } of slots) {
    const { start, end } = SLOT_HOURS[slot];
    byDate.set(date, [...(byDate.get(date) ?? []), `${start}–${end}`]);
  }
  const when = [...byDate].map(
    ([date, times]) =>
      `${calendarDayFormat.format(new Date(`${date}T00:00:00Z`))} (${times.join(", ")})`,
  );
  return dayList.format(when);
}

/**
 * The words Venue Staff read when a coordinator cancels a confirmed booking
 * (SPM-63 AC3): the venue, each date with the times released, and that the
 * booking is now Released, so nobody prepares the venue for it.
 */
export function venueBookingCancelledMessage(
  notice: VenueBookingCancelledNotice,
): NotificationMessage {
  return {
    subject: `${notice.venueLocation} booking cancelled for ${notice.eventName}`,
    body: `The coordinator cancelled the confirmed booking of ${notice.venueLocation} for ${releasedTimes(notice.slots)}. It is now Released, and that time is free to book again.`,
  };
}
