import { z } from "zod";

import { equipmentQuantityField } from "./create-equipment-item-schema";

/** What a catalogue line's "Update stock" form submits (SPM-40 AC2). Shape only. */
export const updateEquipmentStockSchema = z.object({
  equipmentItemId: z.string().trim().min(1, "The equipment item is missing."),
  quantity: equipmentQuantityField,
  location: z.string().trim().min(1, "Enter where the equipment is kept."),
});

export type UpdateEquipmentStockInput = z.infer<typeof updateEquipmentStockSchema>;
