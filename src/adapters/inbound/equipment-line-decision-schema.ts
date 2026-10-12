import { z } from "zod";

/** Which line a Technical Support decision is about (SPM-274). */
export const equipmentLineDecisionSchema = z.object({
  eventId: z.string().trim().min(1, "The event is missing."),
  equipmentItemId: z.string().trim().min(1, "The equipment line is missing."),
});

/**
 * What the mark-unfulfilled form submits (SPM-274 AC3). Shape only: whether
 * the comment says enough is `markEquipmentLineUnfulfilled`'s call.
 */
export const markEquipmentLineUnfulfilledSchema = equipmentLineDecisionSchema.extend({
  comment: z.string(),
});
