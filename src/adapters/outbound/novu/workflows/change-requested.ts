import { workflow } from "@novu/framework";

import { changeRequestedMessage } from "@/adapters/outbound/notification-content/change-requested";
import type { ChangeRequestedNotice } from "@/core/ports/outbound/notifier";

export const CHANGE_REQUESTED_WORKFLOW_ID = "change-requested";

/**
 * The Inbox entry a coordinator sees when an Organiser asks to change their
 * event (SPM-67): the shared wording, plus a click that opens the event's
 * change request, where they decide it (AC4).
 */
export function changeRequestedInApp(notice: ChangeRequestedNotice) {
  return {
    ...changeRequestedMessage(notice),
    redirect: { url: `/staff/coordinator/events/${notice.eventId}/change-request`, target: "_self" as const },
  };
}

export const changeRequested = workflow(
  CHANGE_REQUESTED_WORKFLOW_ID,
  async ({ step, payload }) => {
    // The schema leaves each value open, so it cannot tie a value's type to
    // its field; the notifier sent a `ChangeRequestedNotice` whole.
    await step.inApp("inbox", async () => changeRequestedInApp(payload as ChangeRequestedNotice));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Change requested",
    // Arrangements already made may no longer hold, and only the coordinator
    // decides the request, so no coordinator may switch this off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [CHANGE_REQUESTED_WORKFLOW_ID],
    // Mirrors `ChangeRequestedNotice`; the notifier sends it whole. Each
    // change's value depends on its field, so it is left open here.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        changeRequestId: { type: "string" },
        eventName: { type: "string" },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                enum: [
                  "times",
                  "venue_requirements",
                  "expected_attendance",
                  "equipment_requirements",
                  "registration",
                ],
              },
              value: {},
            },
            required: ["field", "value"],
          },
        },
      },
      required: ["recipientUserAccountId", "eventId", "changeRequestId", "eventName", "changes"],
      additionalProperties: false,
    } as const,
  },
);
