import { rangeStartsAt } from "@/core/domain/event-times";
import type { AttendeeEventChangedNotice, EventRescheduledForAttendeeNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { escapeHtml, eventTimes, fullDateFormat } from "./registration-confirmed";

function linkLines(registrationUrl: string): string[] {
  const url = escapeHtml(registrationUrl);
  return ["<p>Use this link to check or withdraw your registration:<br>", `<a href="${url}">${url}</a></p>`];
}

/**
 * The email an Attendee gets when an event they registered for is rescheduled
 * (SPM-69 AC2): the new date, times and venue, and the link to check or
 * withdraw. Their registration stands (#115). Nothing internal: the notice has
 * no field for a reason or anyone else (AC3).
 */
export function eventRescheduledForAttendeeEmail(
  notice: EventRescheduledForAttendeeNotice,
  registrationUrl: string,
): NotificationMessage {
  const first = notice.times[0];
  const lines = [
    `<p>Hi ${escapeHtml(notice.attendeeName)},</p>`,
    `<p><strong>${escapeHtml(notice.eventName)}</strong> has been rescheduled. Your registration still stands.</p>`,
    "<p>",
    ...(first === undefined ? [] : [`Date: ${escapeHtml(fullDateFormat.format(rangeStartsAt(first)))}<br>`]),
    `Time: ${escapeHtml(eventTimes(notice.times))}<br>`,
    `Venue: ${escapeHtml(notice.venueName ?? "Venue to be confirmed")}`,
    "</p>",
    ...linkLines(registrationUrl),
  ];
  return { subject: `Rescheduled: ${notice.eventName}`, body: lines.join("\n") };
}

/** The email an Attendee gets when an event they registered for is cancelled (SPM-69 AC1, AC3). */
export function eventCancelledForAttendeeEmail(
  notice: AttendeeEventChangedNotice,
  registrationUrl: string,
): NotificationMessage {
  const lines = [
    `<p>Hi ${escapeHtml(notice.attendeeName)},</p>`,
    `<p>We're sorry: <strong>${escapeHtml(notice.eventName)}</strong> has been cancelled and will not take place.</p>`,
    ...linkLines(registrationUrl),
  ];
  return { subject: `Cancelled: ${notice.eventName}`, body: lines.join("\n") };
}
