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
  const { preferredDate, preferredSlots } = notice;
  if (preferredDate === null) {
    return null;
  }
  const day = calendarDayFormat.format(new Date(`${preferredDate}T00:00:00Z`));
  return preferredSlots.length === 0 ? day : `${day}, ${preferredSlots.join(", ")}`;
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
