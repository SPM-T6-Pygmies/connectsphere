import { workflow } from "@novu/framework";

import { equipmentNeedsAttentionMessage } from "@/adapters/outbound/notification-content/equipment-needs-attention";
import type { EquipmentNeedsAttentionNotice } from "@/core/ports/outbound/notifier";

export const EQUIPMENT_NEEDS_ATTENTION_WORKFLOW_ID = "equipment-needs-attention";

/**
 * The Inbox entry Technical Support see when a coordinator changes a line
 * (SPM-64): the shared wording, plus a click that opens the event, where the
 * line is reserved or marked unfulfilled (AC6).
 */
export function equipmentNeedsAttentionInApp(notice: EquipmentNeedsAttentionNotice) {
  return {
    ...equipmentNeedsAttentionMessage(notice),
    redirect: { url: `/staff/technical/${notice.eventId}`, target: "_self" as const },
  };
}

export const equipmentNeedsAttention = workflow(
  EQUIPMENT_NEEDS_ATTENTION_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => equipmentNeedsAttentionInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Equipment recorded",
    // SPM-64 exists so Technical Support hear of every change in time to act
    // on it, so no member may switch it off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [EQUIPMENT_NEEDS_ATTENTION_WORKFLOW_ID],
    // Mirrors `EquipmentNeedsAttentionNotice`; the notifier sends it whole.
    // Plain JSON Schema: @novu/framework 2.x does not read zod 4 schemas.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        preferredDate: { type: ["string", "null"] },
        equipmentType: { type: "string" },
        change: { type: "string", enum: ["added", "edited", "deleted", "removalRequested", "removalWithdrawn"] },
        quantityRequested: { type: "number" },
        quantityWas: { type: ["number", "null"] },
        attention: { type: ["string", "null"], enum: ["new", "changed", "removalRequested", "rescheduled", null] },
      },
      required: [
        "recipientUserAccountId",
        "eventId",
        "eventName",
        "preferredDate",
        "equipmentType",
        "change",
        "quantityRequested",
        "quantityWas",
        "attention",
      ],
      additionalProperties: false,
    } as const,
  },
);
