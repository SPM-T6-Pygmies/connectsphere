import { workflow } from "@novu/framework";

import { coordinatorAssignedMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import { organiserCoordinatorAssignedMessage } from "@/adapters/outbound/notification-content/organiser-coordinator-assigned";
import type { EventCoordinatorAssignedNotice, OrganiserCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

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

/** Who a coordinator assignment is being announced to, and what they are told. */
export type CoordinatorAssignedPayload =
  | ({ readonly audience: "coordinator" } & EventCoordinatorAssignedNotice)
  | ({ readonly audience: "organiser" } & OrganiserCoordinatorAssignedNotice);

export function coordinatorAssignedInbox(payload: CoordinatorAssignedPayload) {
  return payload.audience === "coordinator"
    ? coordinatorAssignedInApp(payload)
    : organiserCoordinatorAssignedInApp(payload);
}

/**
 * One workflow for both sides of an assignment because Novu's plan allows only
 * 20 (see `novu-bridge.test.ts`).
 */
export const coordinatorAssigned = workflow(
  COORDINATOR_ASSIGNED_WORKFLOW_ID,
  async ({ step, payload }) => {
    // The schema is flat, so it cannot tie each field to its audience; the
    // notifier sent a `CoordinatorAssignedPayload` whole.
    await step.inApp("inbox", async () => coordinatorAssignedInbox(payload as CoordinatorAssignedPayload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Coordinator assigned",
    // SPM-57 exists so a coordinator learns of their assignment, and SPM-58 is
    // how an Organiser learns who their point of contact is, so no one may
    // switch it off. Novu locks a whole workflow, not one channel: when email
    // is added here, decide whether it may be turned off (SPM-180).
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [COORDINATOR_ASSIGNED_WORKFLOW_ID],
    // Mirrors `CoordinatorAssignedPayload`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        audience: { type: "string", enum: ["coordinator", "organiser"] },
        recipientUserAccountId: { type: "string" },
        eventRequestId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        clientOrganisationName: { type: ["string", "null"] },
        preferredDate: { type: ["string", "null"] },
        preferredStartTime: { type: ["string", "null"] },
        preferredEndTime: { type: ["string", "null"] },
        coordinatorName: { type: ["string", "null"] },
      },
      required: ["audience", "recipientUserAccountId", "eventRequestId", "eventName"],
      additionalProperties: false,
    } as const,
  },
);
