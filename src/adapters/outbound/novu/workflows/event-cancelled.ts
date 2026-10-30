import { workflow } from "@novu/framework";

import { eventCancelledMessage } from "@/adapters/outbound/notification-content/event-cancelled";
import type { EventCancelledNotice } from "@/core/ports/outbound/notifier";

export const EVENT_CANCELLED_WORKFLOW_ID = "event-cancelled";

/**
 * The Inbox entry an Organiser sees when their event is cancelled (SPM-68):
 * the shared wording, plus a click that opens the request the event came
 * from, where the event shows as Cancelled (AC4). An event whose request is
 * gone opens their request list instead.
 */
export function eventCancelledInApp(notice: EventCancelledNotice) {
  const url =
    notice.eventRequestId === null ? "/staff/requester" : `/staff/requester/${notice.eventRequestId}`;
  return {
    ...eventCancelledMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const eventCancelled = workflow(
  EVENT_CANCELLED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => eventCancelledInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Event cancelled",
    // The Organiser must never be the last to know about their own event (SPM-68), so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EVENT_CANCELLED_WORKFLOW_ID],
    // Mirrors `EventCancelledNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventRequestId: { type: ["string", "null"] },
        eventName: { type: "string" },
      },
      required: ["recipientUserAccountId", "eventId", "eventRequestId", "eventName"],
      additionalProperties: false,
    } as const,
  },
);
