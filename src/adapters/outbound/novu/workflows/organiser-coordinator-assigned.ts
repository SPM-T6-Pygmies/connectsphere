import { workflow } from "@novu/framework";

import { organiserCoordinatorAssignedMessage } from "@/adapters/outbound/notification-content/organiser-coordinator-assigned";
import type { OrganiserCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

export const ORGANISER_COORDINATOR_ASSIGNED_WORKFLOW_ID = "organiser-coordinator-assigned";

/**
 * The Inbox entry an Organiser sees when their request gets a coordinator
 * (SPM-58): the shared wording, plus a click that opens the request in their
 * own workspace (AC4).
 */
export function organiserCoordinatorAssignedInApp(notice: OrganiserCoordinatorAssignedNotice) {
  return {
    ...organiserCoordinatorAssignedMessage(notice),
    redirect: { url: `/staff/requester/${notice.eventRequestId}`, target: "_self" as const },
  };
}

export const organiserCoordinatorAssigned = workflow(
  ORGANISER_COORDINATOR_ASSIGNED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => organiserCoordinatorAssignedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Your coordinator",
    // SPM-58 is how an Organiser learns who their point of contact is, so, like
    // the coordinator's side, it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [ORGANISER_COORDINATOR_ASSIGNED_WORKFLOW_ID],
    // Mirrors `OrganiserCoordinatorAssignedNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventRequestId: { type: "string" },
        eventName: { type: "string" },
        coordinatorName: { type: ["string", "null"] },
      },
      required: ["recipientUserAccountId", "eventRequestId", "eventName", "coordinatorName"],
      additionalProperties: false,
    } as const,
  },
);
