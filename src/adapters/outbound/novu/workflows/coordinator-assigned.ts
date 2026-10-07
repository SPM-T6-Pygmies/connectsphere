import { workflow } from "@novu/framework";

import { coordinatorAssignedMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import type { EventCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

export const COORDINATOR_ASSIGNED_WORKFLOW_ID = "coordinator-assigned";

/**
 * The Inbox entry a coordinator sees (SPM-57): the shared wording, plus a click
 * that opens the request in their own workspace (AC5) -- or, for a reassigned
 * event, the event in My events (SPM-257), since the request stays with
 * whoever reviewed it. `_self` because both live in this app, not somewhere to
 * open alongside it.
 */
export function coordinatorAssignedInApp(notice: EventCoordinatorAssignedNotice) {
  const url =
    notice.eventId === undefined
      ? `/staff/coordinator/${notice.eventRequestId}`
      : `/staff/coordinator/events/${notice.eventId}`;
  return {
    ...coordinatorAssignedMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const coordinatorAssigned = workflow(
  COORDINATOR_ASSIGNED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => coordinatorAssignedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Coordinator assigned",
    // SPM-57 exists so a coordinator learns of their assignment, so no one may
    // switch it off. Novu locks a whole workflow, not one channel: when email
    // is added here, decide whether it may be turned off (SPM-180).
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [COORDINATOR_ASSIGNED_WORKFLOW_ID],
    // Mirrors `EventCoordinatorAssignedNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventRequestId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        clientOrganisationName: { type: ["string", "null"] },
        preferredDate: { type: ["string", "null"] },
        preferredSlots: { type: "array", items: { type: "string", enum: ["AM", "PM", "Night"] } },
      },
      required: [
        "recipientUserAccountId",
        "eventRequestId",
        "eventName",
        "clientOrganisationName",
        "preferredDate",
        "preferredSlots",
      ],
      additionalProperties: false,
    } as const,
  },
);
