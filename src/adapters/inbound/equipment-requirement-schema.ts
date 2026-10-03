import { z } from "zod";

/**
 * What the Coordinator's equipment forms submit (SPM-41).
 *
 * Shape only. Whether a quantity is a whole number of at least 1 (AC3) or the
 * notes fit in 500 characters (AC5) are business rules, and they stay in the
 * domain (`recordEquipmentRequirement`, `editEquipmentRequirement`) so the form
 * and every other caller get the same answer. What the form must do is turn
 * the text a browser posts into the number the use case takes -- and refuse
 * text that is not a number at all, which the domain never sees.
 */

const eventId = z.string().trim().min(1, "The event is missing.");
const equipmentItemId = z.string().trim().min(1, "Choose an equipment type.");

const quantityRequested = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "Enter the quantity as a number.")
  .transform(Number);

/** Optional: a blank box posts an empty string, which the domain stores as no notes. */
const technicalRequirements = z.string();

export const addEquipmentRequirementSchema = z.object({
  eventId,
  equipmentItemId,
  quantityRequested,
  technicalRequirements,
});

/** The same fields: an edit names the line by its type, as there is one line per type (AC2). */
export const editEquipmentRequirementSchema = addEquipmentRequirementSchema;

/** Removing a line, and undoing the removal of one, name only the line. */
export const equipmentLineSchema = z.object({ eventId, equipmentItemId });

export type AddEquipmentRequirementInput = z.infer<typeof addEquipmentRequirementSchema>;
export type EditEquipmentRequirementInput = z.infer<typeof editEquipmentRequirementSchema>;
export type EquipmentLineInput = z.infer<typeof equipmentLineSchema>;
