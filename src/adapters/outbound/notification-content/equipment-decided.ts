import type { EquipmentDecidedNotice, EquipmentLineOutcome } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { eventDateSentence } from "./equipment-needs-attention";

function lineSentence(line: EquipmentLineOutcome): string {
  const by = line.decidedByName === null ? "" : ` by ${line.decidedByName}`;
  return line.outcome === "reserved"
    ? `${line.equipmentType}: ${line.quantityReserved} reserved${by}.`
    : `${line.equipmentType}: unfulfilled${line.comment === null ? "" : ` (${line.comment})`}, marked${by}.`;
}

/**
 * The words a coordinator reads when Technical Support have finished their
 * event's equipment (SPM-65 AC3): whether everything was reserved, then every
 * line's outcome -- how many reserved and by whom, or why it is unfulfilled
 * and who said so -- and when the event runs.
 */
export function equipmentDecidedMessage(notice: EquipmentDecidedNotice): NotificationMessage {
  const unfulfilled = notice.lines.filter((line) => line.outcome === "unfulfilled").length;
  const subject =
    unfulfilled === 0
      ? `Equipment reserved for ${notice.eventName}`
      : `Equipment for ${notice.eventName}: ${unfulfilled} of ${notice.lines.length} ${notice.lines.length === 1 ? "line" : "lines"} unfulfilled`;

  return {
    subject,
    body: [...notice.lines.map(lineSentence), eventDateSentence(notice.preferredDate)].join(" "),
  };
}
