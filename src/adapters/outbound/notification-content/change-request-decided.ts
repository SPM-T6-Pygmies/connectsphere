import type { ChangeRequestDecidedNotice } from "@/core/ports/outbound/notifier";

import { CHANGE_FIELD_LABELS, changeValue } from "./change-requested";
import type { NotificationMessage } from "./coordinator-assigned";

/**
 * The words an Organiser reads once the Coordinator decides their change
 * request (SPM-110): one notice listing what was accepted, then what was
 * declined and why (AC2-AC4), so they know what their event now looks like.
 */
export function changeRequestDecidedMessage(notice: ChangeRequestDecidedNotice): NotificationMessage {
  const accepted = notice.accepted.map((change) => `${CHANGE_FIELD_LABELS[change.field]} → ${changeValue(change)}`);
  const declined = notice.declined.map(
    ({ change, reason }) => `${CHANGE_FIELD_LABELS[change.field]} → ${changeValue(change)} (${reason})`,
  );
  return {
    subject: `Your change request for ${notice.eventName} is decided`,
    body: [
      ...(accepted.length > 0 ? [`Accepted: ${accepted.join("; ")}.`] : []),
      ...(declined.length > 0 ? [`Declined: ${declined.join("; ")}.`] : []),
    ].join(" "),
  };
}
