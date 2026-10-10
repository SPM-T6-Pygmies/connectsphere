import type { SafetyCheckRecordedNotice } from "@/core/ports/outbound/notifier";

import type { NotificationMessage } from "./coordinator-assigned";

/**
 * The words a coordinator reads when their event's safety check is recorded
 * (SPM-263). A rejection carries the Safety Officer's comments in full, since
 * they say what must change (AC2). An approval says the event can go on to
 * confirmation, with the Officer's note only if they left one (AC3).
 */
export function safetyCheckRecordedMessage(notice: SafetyCheckRecordedNotice): NotificationMessage {
  if (notice.outcome === "Rejected") {
    return {
      subject: `${notice.eventName} failed its safety check`,
      body: `The Safety Officer rejected ${notice.eventName}. Changes needed: ${notice.comments ?? "none given"}`,
    };
  }

  const approved = `The Safety Officer approved ${notice.eventName}. It can go on to confirmation.`;
  return {
    subject: `${notice.eventName} passed its safety check`,
    body: notice.comments === null ? approved : `${approved} Note: ${notice.comments}`,
  };
}
