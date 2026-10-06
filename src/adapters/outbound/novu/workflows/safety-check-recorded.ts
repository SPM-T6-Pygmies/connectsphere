import { workflow } from "@novu/framework";

import { safetyCheckRecordedMessage } from "@/adapters/outbound/notification-content/safety-check-recorded";
import type { SafetyCheckRecordedNotice } from "@/core/ports/outbound/notifier";

export const SAFETY_CHECK_RECORDED_WORKFLOW_ID = "safety-check-recorded";

/**
 * The Inbox entry a coordinator sees when their event's safety check is
 * recorded (SPM-263): the shared wording, plus a click that opens the event in
 * their own workspace (AC4).
 */
export function safetyCheckRecordedInApp(notice: SafetyCheckRecordedNotice) {
  return {
    ...safetyCheckRecordedMessage(notice),
    redirect: { url: `/staff/coordinator/events/${notice.eventId}`, target: "_self" as const },
  };
}

export const safetyCheckRecorded = workflow(
  SAFETY_CHECK_RECORDED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => safetyCheckRecordedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Safety check outcome",
    // A rejection is how a coordinator learns rework is needed, so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [SAFETY_CHECK_RECORDED_WORKFLOW_ID],
    // Mirrors `SafetyCheckRecordedNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        outcome: { type: "string", enum: ["Approved", "Rejected"] },
        comments: { type: ["string", "null"] },
      },
      required: ["recipientUserAccountId", "eventId", "eventName", "outcome", "comments"],
      additionalProperties: false,
    } as const,
  },
);
