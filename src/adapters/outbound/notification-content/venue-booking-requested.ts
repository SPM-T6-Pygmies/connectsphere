import type { TimeRangeOnDate } from "@/core/domain/event-times";
import type { VenueBookingRequestedNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

const dayList = new Intl.ListFormat("en-SG", { style: "long", type: "conjunction" });

/**
 * Each date with its start and end times, as "Fri, 20 Nov 2026 (07:00–12:00,
 * 13:00–18:00) and Sat, 21 Nov 2026 (19:00–24:00)" (SPM-324). The times
 * arrive sorted, so grouping keeps them in the order they fall.
 */
export function timeDays(times: readonly TimeRangeOnDate[]): string {
  const byDate = new Map<string, string[]>();
  for (const { date, start, end } of times) {
    byDate.set(date, [...(byDate.get(date) ?? []), `${start}–${end}`]);
  }
  const when = [...byDate].map(
    ([date, dayTimes]) =>
      `${calendarDayFormat.format(new Date(`${date}T00:00:00Z`))} (${dayTimes.join(", ")})`,
  );
  return dayList.format(when);
}

/**
 * The words Venue Staff read when a coordinator asks for a venue (SPM-61
 * AC2, SPM-324 AC4): the venue, and each date with the times wanted on it.
 */
export function venueBookingRequestedMessage(
  notice: VenueBookingRequestedNotice,
): NotificationMessage {
  return {
    subject: `${notice.venueLocation} requested for ${notice.eventName}`,
    body: `Requested for ${timeDays(notice.times)}. Approve or reject it.`,
  };
}
