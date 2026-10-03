import type { EventCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

/**
 * The words a coordinator reads when a request is assigned to them (SPM-57),
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

// Singapore time, as everywhere else the system renders an instant (#36).
const dayFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
// `preferredDate` is a calendar date, not an instant: read it in UTC so no
// zone shifts it onto a neighbouring day.
const calendarDayFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function requestedWhen(notice: EventCoordinatorAssignedNotice): string | null {
  const { preferredDate, preferredStartTime, preferredEndTime } = notice;
  if (preferredStartTime !== null && preferredEndTime !== null) {
    const start = new Date(preferredStartTime);
    const end = new Date(preferredEndTime);
    const startDay = dayFormat.format(start);
    const endDay = dayFormat.format(end);
    return startDay === endDay
      ? `${startDay}, ${timeFormat.format(start)} – ${timeFormat.format(end)}`
      : `${startDay}, ${timeFormat.format(start)} – ${endDay}, ${timeFormat.format(end)}`;
  }
  if (preferredDate !== null) {
    return calendarDayFormat.format(new Date(`${preferredDate}T00:00:00Z`));
  }
  return null;
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
    body: `${event} is now yours to review. ${
      when === null ? "No date has been requested yet." : `Requested for ${when}.`
    }`,
  };
}
