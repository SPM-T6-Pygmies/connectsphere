import { workflow } from "@novu/framework";

import { clarificationRequestedMessage } from "@/adapters/outbound/notification-content/clarification-requested";
import type { ClarificationRequestedNotice } from "@/core/ports/outbound/notifier";

export const CLARIFICATION_REQUESTED_WORKFLOW_ID = "clarification-requested";

/**
 * The Inbox entry an Organiser sees when their request is returned with a
 * question (SPM-59): the shared wording, plus a click that opens the request
 * in their own workspace, where they can reply (AC3).
 */
export function clarificationRequestedInApp(notice: ClarificationRequestedNotice) {
  return {
    ...clarificationRequestedMessage(notice),
    redirect: { url: `/staff/requester/${notice.eventRequestId}`, target: "_self" as const },
  };
}

export const clarificationRequested = workflow(
  CLARIFICATION_REQUESTED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => clarificationRequestedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Clarification requested",
    // A returned request waits on the Organiser, so SPM-59 cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [CLARIFICATION_REQUESTED_WORKFLOW_ID],
    // Mirrors `ClarificationRequestedNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventRequestId: { type: "string" },
        eventName: { type: "string" },
        message: { type: "string" },
      },
      required: ["recipientUserAccountId", "eventRequestId", "eventName", "message"],
      additionalProperties: false,
    } as const,
  },
);
