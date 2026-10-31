import { workflow } from "@novu/framework";

import { changeRequestDecidedMessage } from "@/adapters/outbound/notification-content/change-request-decided";
import type { ChangeRequestDecidedNotice } from "@/core/ports/outbound/notifier";

export const CHANGE_REQUEST_DECIDED_WORKFLOW_ID = "change-request-decided";

const CHANGE_SCHEMA = {
  type: "object",
  properties: {
    field: {
      type: "string",
      enum: ["times", "venue_requirements", "expected_attendance", "equipment_requirements", "registration"],
    },
    value: {},
  },
  required: ["field", "value"],
} as const;

/**
 * The Inbox entry an Organiser sees once their change request is decided
 * (SPM-110): the shared wording, plus a click that opens their request, where
 * the event as it now stands is shown.
 */
export function changeRequestDecidedInApp(notice: ChangeRequestDecidedNotice) {
  const url = notice.eventRequestId === null ? "/staff/requester" : `/staff/requester/${notice.eventRequestId}`;
  return {
    ...changeRequestDecidedMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const changeRequestDecided = workflow(
  CHANGE_REQUEST_DECIDED_WORKFLOW_ID,
  async ({ step, payload }) => {
    // The schema leaves each value open, so it cannot tie a value's type to
    // its field; the notifier sent a `ChangeRequestDecidedNotice` whole.
    await step.inApp("inbox", async () => changeRequestDecidedInApp(payload as ChangeRequestDecidedNotice));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Change request decided",
    // The Organiser must know what their event now looks like, so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [CHANGE_REQUEST_DECIDED_WORKFLOW_ID],
    // Mirrors `ChangeRequestDecidedNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        changeRequestId: { type: "string" },
        eventRequestId: { type: ["string", "null"] },
        eventName: { type: "string" },
        accepted: { type: "array", items: CHANGE_SCHEMA },
        declined: {
          type: "array",
          items: {
            type: "object",
            properties: { change: CHANGE_SCHEMA, reason: { type: "string" } },
            required: ["change", "reason"],
          },
        },
      },
      required: [
        "recipientUserAccountId",
        "eventId",
        "changeRequestId",
        "eventRequestId",
        "eventName",
        "accepted",
        "declined",
      ],
      additionalProperties: false,
    } as const,
  },
);
