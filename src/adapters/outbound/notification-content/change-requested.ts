import type { ChangeRequestField, RequestedChange } from "@/core/domain/change-request";
import type { ChangeRequestedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";
import { timeDays } from "./venue-booking-requested";

/** As the Coordinator's change request page names them. */
export const CHANGE_FIELD_LABELS: Readonly<Record<ChangeRequestField, string>> = {
  times: "Date and times",
  venue_requirements: "Venue requirements",
  expected_attendance: "Expected attendance",
  equipment_requirements: "Equipment requirements",
  registration: "Registration",
};

/**
 * One field's value as a person reads it. Times are venue time, and the text
 * is written on the server, where the reader's zone is unknown, so the zone
 * is named.
 */
export function changeValue(change: RequestedChange): string {
  switch (change.field) {
    case "times":
      return `${timeDays(change.value)} (GMT+8)`;
    case "venue_requirements":
      return change.value;
    case "expected_attendance":
      return String(change.value);
    case "equipment_requirements":
      return change.value ?? "Not applicable";
    case "registration":
      if (change.value === null) {
        return "Not applicable";
      }
      return change.value.enabled
        ? `Open ${change.value.opensOn ?? "—"} to ${change.value.closesOn ?? "—"}`
        : "Off";
  }
}

/**
 * The words a Coordinator reads when the Organiser of an event assigned to
 * them asks for a change (SPM-67 AC2): each field asked for, with the value
 * wanted, and that they decide it on the change request.
 */
export function changeRequestedMessage(notice: ChangeRequestedNotice): NotificationMessage {
  const lines = notice.changes.map((change) => `${CHANGE_FIELD_LABELS[change.field]} → ${changeValue(change)}`);
  return {
    subject: `Change requested for ${notice.eventName}`,
    body: `The Organiser of ${notice.eventName} asks to change: ${lines.join("; ")}. Open the change request to accept or decline each change.`,
  };
}
