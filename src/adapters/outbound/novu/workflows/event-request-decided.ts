import { workflow } from "@novu/framework";

import { eventRequestDecidedMessage } from "@/adapters/outbound/notification-content/event-request-decided";
import type { EventRequestDecidedNotice } from "@/core/ports/outbound/notifier";

export const EVENT_REQUEST_DECIDED_WORKFLOW_ID = "event-request-decided";

/**
 * The Inbox entry an Organiser sees when their request is approved or rejected
 * (SPM-60): the shared wording, plus a click that opens the request in their
 * own workspace (AC4).
 */
export function eventRequestDecidedInApp(notice: EventRequestDecidedNotice) {
  return {
    ...eventRequestDecidedMessage(notice),
    redirect: { url: `/staff/requester/${notice.eventRequestId}`, target: "_self" as const },
  };
}

export const eventRequestDecided = workflow(
  EVENT_REQUEST_DECIDED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => eventRequestDecidedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Request decided",
    // SPM-60 is how an Organiser learns whether planning has begun, so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EVENT_REQUEST_DECIDED_WORKFLOW_ID],
    // Mirrors `EventRequestDecidedNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventRequestId: { type: "string" },
        eventName: { type: "string" },
        decision: { type: "string", enum: ["approved", "rejected"] },
        decisionRecord: { type: ["string", "null"] },
      },
      required: ["recipientUserAccountId", "eventRequestId", "eventName", "decision", "decisionRecord"],
      additionalProperties: false,
    } as const,
  },
);
