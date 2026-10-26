import { rangeEndsAt, rangeStartsAt } from "@/core/domain/event-times";
import type { EventCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

/**
 * The words a coordinator reads when a request is assigned to them (SPM-57),
 * or an approved event is reassigned to them (SPM-257),
 * shared by every channel that says it -- the Novu in-app step and the copy
 * kept in the `notification` table -- so the two never disagree.
 *
 * Informational only: assignment takes effect immediately, so nothing here
 * asks the coordinator to accept it (#95).
 */
export interface NotificationMessage {
  readonly subject: string;
  readonly body: string;
}

// `preferredDate` is a calendar date, not an instant: read it in UTC so no
// zone shifts it onto a neighbouring day.
export const calendarDayFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

// A notice has no viewer timezone to follow, so the requested time stays in
// venue time and names the zone, as the registration email does (SPM-326).
const venueTimeFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function requestedWhen(notice: EventCoordinatorAssignedNotice): string | null {
  const { preferredDate: date, preferredStartTime: start, preferredEndTime: end } = notice;
  if (date === null) {
    return null;
  }
  const day = calendarDayFormat.format(new Date(`${date}T00:00:00Z`));
  if (start === null || end === null) {
    return day;
  }
  const range = { date, start, end };
  return `${day}, ${venueTimeFormat.format(rangeStartsAt(range))} – ${venueTimeFormat.format(rangeEndsAt(range))} (GMT+8)`;
}

export function coordinatorAssignedMessage(
  notice: EventCoordinatorAssignedNotice,
): NotificationMessage {
  const event =
    notice.clientOrganisationName === null
      ? notice.eventName
      : `${notice.eventName} for ${notice.clientOrganisationName}`;
  const when = requestedWhen(notice);

  return {
    subject: `${notice.eventName} has been assigned to you`,
    body: `${event} is now yours to ${notice.eventId === undefined ? "review" : "plan"}. ${
      when === null ? "No date has been requested yet." : `Requested for ${when}.`
    }`,
  };
}
