import { workflow } from "@novu/framework";

import { equipmentDecidedMessage } from "@/adapters/outbound/notification-content/equipment-decided";
import type { EquipmentDecidedNotice } from "@/core/ports/outbound/notifier";

export const EQUIPMENT_DECIDED_WORKFLOW_ID = "equipment-decided";

/**
 * The Inbox entry a coordinator sees when Technical Support have finished
 * their event's equipment (SPM-65): the shared wording, plus a click that
 * opens the event's Equipment tab, where an unfulfilled line can be changed
 * or removed (AC5).
 */
export function equipmentDecidedInApp(notice: EquipmentDecidedNotice) {
  return {
    ...equipmentDecidedMessage(notice),
    redirect: { url: `/staff/coordinator/events/${notice.eventId}?tab=equipment`, target: "_self" as const },
  };
}

export const equipmentDecided = workflow(
  EQUIPMENT_DECIDED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => equipmentDecidedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Equipment decided",
    // An unfulfilled line is how a coordinator learns to find an alternative,
    // so it cannot be switched off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EQUIPMENT_DECIDED_WORKFLOW_ID],
    // Mirrors `EquipmentDecidedNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        preferredDate: { type: ["string", "null"] },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              equipmentType: { type: "string" },
              quantityRequested: { type: "number" },
              outcome: { type: "string", enum: ["reserved", "unfulfilled"] },
              quantityReserved: { type: "number" },
              decidedByName: { type: ["string", "null"] },
              comment: { type: ["string", "null"] },
            },
            required: [
              "equipmentType",
              "quantityRequested",
              "outcome",
              "quantityReserved",
              "decidedByName",
              "comment",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["recipientUserAccountId", "eventId", "eventName", "preferredDate", "lines"],
      additionalProperties: false,
    } as const,
  },
);
