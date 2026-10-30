import type { LapsedArrangement } from "@/core/domain/event-readiness";
import type { EventNoLongerConfirmedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";

const list = new Intl.ListFormat("en-SG", { style: "long", type: "conjunction" });

/** What lapsed, in plain words: no internal notes, no reasons recorded by staff. */
function lapsedWords(lapsed: LapsedArrangement): string {
  switch (lapsed.kind) {
    case "arrangement":
      switch (lapsed.type) {
        case "venue":
          return "its venue booking is no longer confirmed";
        case "programme":
          return "its programme is missing";
        case "registration":
          return "its registration is not set up";
        default:
          return `its ${lapsed.type.replace("_", " ")} arrangement is incomplete`;
      }
    case "equipment":
      return `the ${lapsed.equipmentType} is no longer reserved in full`;
    case "flagged-booking":
      return `its booking of ${lapsed.venueLocation} is being re-checked`;
    case "safety-check":
      return "its safety check is no longer approved";
  }
}

/**
 * The words an Organiser reads when their Confirmed event goes back to
 * Planning (SPM-111 AC2): which arrangements lapsed, that the event is in
 * Planning now, and that the coordinator will confirm it again (#105).
 */
export function eventNoLongerConfirmedMessage(notice: EventNoLongerConfirmedNotice): NotificationMessage {
  return {
    subject: `${notice.eventName} is no longer confirmed`,
    body: `${notice.eventName} is back in Planning: ${list.format(notice.lapsed.map(lapsedWords))}. Your coordinator will confirm it again once this is sorted out; until then, do not rely on these arrangements.`,
  };
}
