import { workflow } from "@novu/framework";

import { organiserMessagePostedMessage } from "@/adapters/outbound/notification-content/organiser-message-posted";
import type { OrganiserMessagePostedNotice } from "@/core/ports/outbound/notifier";

export const ORGANISER_MESSAGE_POSTED_WORKFLOW_ID = "organiser-message-posted";

/**
 * The Inbox entry a Coordinator sees when the Organiser posts on a request
 * assigned to them (SPM-164): the shared wording, plus a click that opens the
 * request in their own workspace, where the thread is (AC3).
 */
export function organiserMessagePostedInApp(notice: OrganiserMessagePostedNotice) {
  return {
    ...organiserMessagePostedMessage(notice),
    redirect: { url: `/staff/coordinator/${notice.eventRequestId}`, target: "_self" as const },
  };
}

export const organiserMessagePosted = workflow(
  ORGANISER_MESSAGE_POSTED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => organiserMessagePostedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Organiser message",
    // Nothing else on the request changes when the Organiser answers, so SPM-164 cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [ORGANISER_MESSAGE_POSTED_WORKFLOW_ID],
    // Mirrors `OrganiserMessagePostedNotice`; the notifier sends it whole.
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
