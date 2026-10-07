import { equipmentItemId, type EquipmentItem } from "@/core/domain/equipment-item";
import {
  EquipmentItemNotFoundError,
  InvalidOutOfServiceCountError,
  NotTechnicalSupportStaffError,
  type DomainError,
} from "@/core/domain/errors";

/** A row of `technical_support_equipment_catalogue` or `technical_support_create_equipment_item`. */
export interface EquipmentCatalogueItemRow {
  equipment_item_id: number;
  type: string;
  description: string | null;
  quantity: number;
  physical_location: string | null;
  out_of_service: number;
}

export function toEquipmentItem(row: EquipmentCatalogueItemRow): EquipmentItem {
  return {
    id: equipmentItemId(String(row.equipment_item_id)),
    type: row.type,
    description: row.description,
    quantity: row.quantity,
    // The column is nullable for rows written before the catalogue required a location.
    location: row.physical_location ?? "",
    outOfService: row.out_of_service,
  };
}

/**
 * The domain error a catalogue function's SQLSTATE stands for -- see
 * 20261013163432_equipment_out_of_service.sql -- or null for anything else,
 * which the caller reports as the unexpected failure it is. Only an update
 * names an item, so only an update can be refused for one (CS041, CS042).
 */
export function toEquipmentCatalogueError(
  error: { readonly code?: string },
  item?: Pick<EquipmentItem, "id" | "quantity">,
): DomainError | null {
  if (error.code === "CS040") {
    return new NotTechnicalSupportStaffError();
  }
  if (item !== undefined && error.code === "CS041") {
    return new EquipmentItemNotFoundError(item.id);
  }
  if (item !== undefined && error.code === "CS042") {
    return new InvalidOutOfServiceCountError(item.quantity);
  }
  return null;
}
