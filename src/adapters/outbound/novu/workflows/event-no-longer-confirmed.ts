import { workflow } from "@novu/framework";

import { eventNoLongerConfirmedMessage } from "@/adapters/outbound/notification-content/event-no-longer-confirmed";
import type { EventNoLongerConfirmedNotice } from "@/core/ports/outbound/notifier";

export const EVENT_NO_LONGER_CONFIRMED_WORKFLOW_ID = "event-no-longer-confirmed";

/**
 * The Inbox entry an Organiser sees when their Confirmed event goes back to
 * Planning (SPM-111): the shared wording, plus a click that opens their
 * request, where **Your event** shows it in Planning.
 */
export function eventNoLongerConfirmedInApp(notice: EventNoLongerConfirmedNotice) {
  const url = notice.eventRequestId === null ? "/staff/requester" : `/staff/requester/${notice.eventRequestId}`;
  return {
    ...eventNoLongerConfirmedMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const eventNoLongerConfirmed = workflow(
  EVENT_NO_LONGER_CONFIRMED_WORKFLOW_ID,
  async ({ step, payload }) => {
    // The schema leaves each lapsed arrangement open, so it cannot tie its
    // fields to its kind; the notifier sent an `EventNoLongerConfirmedNotice` whole.
    await step.inApp("inbox", async () => eventNoLongerConfirmedInApp(payload as EventNoLongerConfirmedNotice));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Event no longer confirmed",
    // The Organiser must not keep relying on arrangements that no longer hold, so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EVENT_NO_LONGER_CONFIRMED_WORKFLOW_ID],
    // Mirrors `EventNoLongerConfirmedNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventRequestId: { type: ["string", "null"] },
        eventName: { type: "string" },
        lapsed: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["arrangement", "equipment", "flagged-booking", "safety-check"] },
            },
            required: ["kind"],
          },
        },
      },
      required: ["recipientUserAccountId", "eventId", "eventRequestId", "eventName", "lapsed"],
      additionalProperties: false,
    } as const,
  },
);
