import type { EquipmentNeedsAttentionNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

/** "Event date: Sun, 15 Nov 2026." or, before it is scheduled, "No event date set yet." */
export function eventDateSentence(preferredDate: string | null): string {
  return preferredDate === null
    ? "No event date set yet."
    : `Event date: ${calendarDayFormat.format(new Date(`${preferredDate}T00:00:00Z`))}.`;
}

/**
 * The words Technical Support read when a coordinator changes a line (SPM-64
 * AC5): the event, its date, the type and quantity, what the coordinator did,
 * and whether it leaves anything for them to do -- a changed decision or a
 * removal request needing re-review rather than standing (AC2). SPM-311: and
 * when accepting new dates released the line, which needs reserving again.
 */
export function equipmentNeedsAttentionMessage(
  notice: EquipmentNeedsAttentionNotice,
): NotificationMessage {
  const { equipmentType, eventName, quantityRequested, quantityWas } = notice;
  const when = eventDateSentence(notice.preferredDate);

  switch (notice.change) {
    case "added":
      return {
        subject: `${equipmentType} requested for ${eventName}`,
        body: `${quantityRequested} requested. ${when}`,
      };
    case "edited": {
      const what =
        quantityWas === null
          ? `Technical requirements changed; ${quantityRequested} requested.`
          : `Now ${quantityRequested} requested, was ${quantityWas}.`;
      const next =
        notice.attention === "new"
          ? "It still awaits a decision."
          : notice.attention === null
            ? "That is what was decided, so the earlier decision stands."
            : "The earlier decision needs re-review.";
      return {
        subject: `${equipmentType} changed on ${eventName}`,
        body: `${what} ${next} ${when}`,
      };
    }
    case "deleted":
      return {
        subject: `${equipmentType} removed from ${eventName}`,
        body: `The coordinator removed this line. Nothing was reserved, so there is nothing to do. ${when}`,
      };
    case "removalRequested":
      return {
        subject: `${equipmentType} removal requested on ${eventName}`,
        body: `The coordinator asked to remove this line. Its reservation needs re-review. ${when}`,
      };
    case "removalWithdrawn":
      return {
        subject: `${equipmentType} removal withdrawn on ${eventName}`,
        body: `The coordinator is keeping this line. ${
          notice.attention === null ? "Its reservation stands." : "It still needs re-review as changed."
        } ${when}`,
      };
    case "rescheduled":
      return {
        subject: `${equipmentType} released on ${eventName}`,
        body: `The event's dates changed, so its reservation was released. ${
          notice.attention === null
            ? "Its removal was requested, so the line is gone and there is nothing to do."
            : `${quantityRequested} requested; reserve them again for the new date.`
        } ${when}`,
      };
  }
}
