import { z } from "zod";

/**
 * A quantity as a form submits it: digits only, so a blank, negative or
 * fractional entry is turned away here with a message the form can show.
 * Whether the count is acceptable to the business stays `newEquipmentItem`'s call.
 */
export const equipmentQuantityField = z
  .string()
  .trim()
  .regex(/^\d+$/, "Quantity must be a whole number, zero or more.")
  .transform(Number);

/** What the "Add equipment" form submits (SPM-40 AC1). Shape only. */
export const createEquipmentItemSchema = z.object({
  type: z.string().trim().min(1, "Enter the equipment type."),
  description: z.string(),
  quantity: equipmentQuantityField,
  location: z.string().trim().min(1, "Enter where the equipment is kept."),
});

export type CreateEquipmentItemInput = z.infer<typeof createEquipmentItemSchema>;
