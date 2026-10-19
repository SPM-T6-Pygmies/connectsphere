import { SLOT_HOURS, type SlotOnDate } from "@/core/domain/booking";
import type { RegistrationConfirmedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";

// Mirrors `src/app/events/format-event-time.ts`, which an outbound adapter may
// not import, so the email reads the date and time exactly as the on-screen
// confirmation does (SPM-87 AC2).
const TIME_ZONE = "Asia/Singapore";
const fullDateFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dayMonthFormat = new Intl.DateTimeFormat("en-SG", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function slotTimes(slots: readonly SlotOnDate[]): string {
  const multiDay = slots.some((slot) => slot.date !== slots[0].date);
  return slots
    .map(({ date, slot }) => {
      const { start, end } = SLOT_HOURS[slot];
      const startsAt = new Date(`${date}T${start}:00+08:00`);
      const hours = `${slot} (${timeFormat.format(startsAt)} – ${timeFormat.format(new Date(`${date}T${end}:00+08:00`))})`;
      return multiDay ? `${dayMonthFormat.format(startsAt)} ${hours}` : hours;
    })
    .join(", ");
}

// Event and attendee names are typed by people, and the body is HTML.
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The email an Attendee gets once registered (SPM-87): the event as the
 * confirmation panel shows it, and the link that is their only way back to
 * check or withdraw the registration. Deliberately plain.
 */
export function registrationConfirmedEmail(
  notice: RegistrationConfirmedNotice,
  registrationUrl: string,
): NotificationMessage {
  const url = escapeHtml(registrationUrl);
  const lines = [
    `<p>Hi ${escapeHtml(notice.attendeeName)},</p>`,
    `<p>You're registered for <strong>${escapeHtml(notice.eventName)}</strong>.</p>`,
    "<p>",
    `Date: ${escapeHtml(fullDateFormat.format(new Date(notice.startsAt)))}<br>`,
    `Time: ${escapeHtml(slotTimes(notice.slots))}<br>`,
    `Venue: ${escapeHtml(notice.venueName ?? "Venue to be confirmed")}`,
    "</p>",
    "<p>Use this link to check or withdraw your registration:<br>",
    `<a href="${url}">${url}</a></p>`,
  ];

  return {
    subject: `You're registered: ${notice.eventName}`,
    body: lines.join("\n"),
  };
}
