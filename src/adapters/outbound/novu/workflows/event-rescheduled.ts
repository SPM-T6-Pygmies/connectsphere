import { workflow } from "@novu/framework";

import { eventRescheduledMessage } from "@/adapters/outbound/notification-content/event-rescheduled";
import type { EventRescheduledNotice } from "@/core/ports/outbound/notifier";

export const EVENT_RESCHEDULED_WORKFLOW_ID = "event-rescheduled";

/**
 * The Inbox entry an Organiser sees when their event is rescheduled (SPM-68):
 * the shared wording, plus a click that opens the request the event came
 * from, where its new times are shown (AC4). An event whose request is gone
 * opens their request list instead.
 */
export function eventRescheduledInApp(notice: EventRescheduledNotice) {
  const url =
    notice.eventRequestId === null ? "/staff/requester" : `/staff/requester/${notice.eventRequestId}`;
  return {
    ...eventRescheduledMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const eventRescheduled = workflow(
  EVENT_RESCHEDULED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => eventRescheduledInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Event rescheduled",
    // The Organiser must never be the last to know about their own event (SPM-68), so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EVENT_RESCHEDULED_WORKFLOW_ID],
    // Mirrors `EventRescheduledNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventRequestId: { type: ["string", "null"] },
        eventName: { type: "string" },
        times: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              start: { type: "string" },
              end: { type: "string" },
            },
            required: ["date", "start", "end"],
            additionalProperties: false,
          },
        },
        backToPlanning: { type: "boolean" },
      },
      required: ["recipientUserAccountId", "eventId", "eventRequestId", "eventName", "times", "backToPlanning"],
      additionalProperties: false,
    } as const,
  },
);
