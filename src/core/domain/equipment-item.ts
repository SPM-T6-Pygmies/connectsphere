import type { Brand } from "./brand";
import { InvalidEquipmentItemIdError } from "./errors";

/**
 * An entry in the equipment catalogue (`equipment_item`). An equipment
 * requirement's "type" is one of these, picked from the catalogue rather than
 * typed free-hand (SPM-41 AC4).
 */
export type EquipmentItemId = Brand<string, "EquipmentItemId">;

export function equipmentItemId(raw: string): EquipmentItemId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidEquipmentItemIdError(raw);
  }
  return trimmed as EquipmentItemId;
}

/** One entry in the equipment catalogue, as a coordinator picks from it (SPM-41 AC1, AC4). */
export interface EquipmentCatalogueItem {
  readonly id: EquipmentItemId;
  /** What the catalogue calls it -- "Projector", "Wireless microphone". */
  readonly type: string;
}
