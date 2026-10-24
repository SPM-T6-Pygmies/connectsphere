import { workflow } from "@novu/framework";

import { eventConfirmedMessage } from "@/adapters/outbound/notification-content/event-confirmed";
import type { EventConfirmedNotice } from "@/core/ports/outbound/notifier";

export const EVENT_CONFIRMED_WORKFLOW_ID = "event-confirmed";

/**
 * The Inbox entry an Organiser sees when their event is confirmed (SPM-66):
 * the shared wording, plus a click that opens the request the event came
 * from, where its confirmed arrangements are shown (AC3). An event whose
 * request is gone opens their request list instead.
 */
export function eventConfirmedInApp(notice: EventConfirmedNotice) {
  const url =
    notice.eventRequestId === null ? "/staff/requester" : `/staff/requester/${notice.eventRequestId}`;
  return {
    ...eventConfirmedMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const eventConfirmed = workflow(
  EVENT_CONFIRMED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => eventConfirmedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Event confirmed",
    // Confirmation is when ConnectSphere commits to the event (#80), so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EVENT_CONFIRMED_WORKFLOW_ID],
    // Mirrors `EventConfirmedNotice`; the notifier sends it whole.
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
        venueLocation: { type: ["string", "null"] },
        equipment: {
          type: "array",
          items: {
            type: "object",
            properties: {
              equipmentType: { type: "string" },
              quantityReserved: { type: "number" },
            },
            required: ["equipmentType", "quantityReserved"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "recipientUserAccountId",
        "eventId",
        "eventRequestId",
        "eventName",
        "times",
        "venueLocation",
        "equipment",
      ],
      additionalProperties: false,
    } as const,
  },
);
