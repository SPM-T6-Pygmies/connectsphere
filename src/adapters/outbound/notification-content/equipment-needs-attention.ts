import type { EquipmentNeedsAttentionNotice } from "@/core/ports/outbound/notifier";

import { calendarDayFormat, type NotificationMessage } from "./coordinator-assigned";

/** "Event date: Sun, 15 Nov 2026." or, before it is scheduled, "No event date set yet." */
export function eventDateSentence(preferredDate: string | null): string {
  return preferredDate === null
    ? "No event date set yet."
    : `Event date: ${calendarDayFormat.format(new Date(`${preferredDate}T00:00:00Z`))}.`;
}

/**
 * The words Technical Support read when a coordinator's change puts a line in
 * front of them (SPM-64 AC5): the event, its date, the type and quantity, and
 * why -- a changed line or a removal request saying the earlier decision
 * needs re-review rather than standing (AC2).
 */
export function equipmentNeedsAttentionMessage(
  notice: EquipmentNeedsAttentionNotice,
): NotificationMessage {
  const { equipmentType, eventName, quantityRequested, quantityWas } = notice;
  const when = eventDateSentence(notice.preferredDate);

  switch (notice.reason) {
    case "new":
      return {
        subject: `${equipmentType} requested for ${eventName}`,
        body: `${quantityRequested} requested. ${when}`,
      };
    case "changed": {
      const what =
        quantityWas === null || quantityWas === quantityRequested
          ? `Technical requirements changed; ${quantityRequested} requested.`
          : `Now ${quantityRequested} requested, was ${quantityWas}.`;
      return {
        subject: `${equipmentType} changed on ${eventName}`,
        body: `${what} The earlier decision needs re-review. ${when}`,
      };
    }
    case "removalRequested":
      return {
        subject: `${equipmentType} removal requested on ${eventName}`,
        body: `The coordinator asked to remove this line. Its reservation needs re-review. ${when}`,
      };
  }
}
