import { workflow } from "@novu/framework";

import { safetyCheckReadyMessage } from "@/adapters/outbound/notification-content/safety-check-ready";
import type { SafetyCheckReadyNotice } from "@/core/ports/outbound/notifier";

export const SAFETY_CHECK_READY_WORKFLOW_ID = "safety-check-ready";

/**
 * The Inbox entry a Safety Officer sees (SPM-262): the shared wording, plus a
 * click that opens their Awaiting check list (AC6). The event's own safety
 * check page is SPM-260's; until it exists, the list is where the event is.
 */
export function safetyCheckReadyInApp(notice: SafetyCheckReadyNotice) {
  return {
    ...safetyCheckReadyMessage(notice),
    redirect: { url: "/staff/safety", target: "_self" as const },
  };
}

export const safetyCheckReady = workflow(
  SAFETY_CHECK_READY_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => safetyCheckReadyInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Ready for safety check",
    // The check gates confirmation (SPM-264), so no Safety Officer may switch
    // off hearing that one is due.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [SAFETY_CHECK_READY_WORKFLOW_ID],
    // Mirrors `SafetyCheckReadyNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        preferredDate: { type: ["string", "null"] },
      },
      required: ["recipientUserAccountId", "eventId", "eventName", "preferredDate"],
      additionalProperties: false,
    } as const,
  },
);
