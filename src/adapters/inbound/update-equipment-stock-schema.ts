import { z } from "zod";

import { equipmentQuantityField } from "./create-equipment-item-schema";

/**
 * What a catalogue card's form submits (SPM-40 AC2, SPM-17 AC1). Shape only:
 * whether the out-of-service count fits what is owned is `updateEquipmentStock`'s call.
 */
export const updateEquipmentStockSchema = z.object({
  equipmentItemId: z.string().trim().min(1, "The equipment item is missing."),
  quantity: equipmentQuantityField,
  location: z.string().trim().min(1, "Enter where the equipment is kept."),
  outOfService: z
    .string()
    .trim()
    .regex(/^\d+$/, "Out of service must be a whole number, zero or more.")
    .transform(Number),
});

export type UpdateEquipmentStockInput = z.infer<typeof updateEquipmentStockSchema>;
