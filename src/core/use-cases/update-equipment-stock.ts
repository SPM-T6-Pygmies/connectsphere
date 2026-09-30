import { equipmentItemId, updateEquipmentStock } from "../domain/equipment-item";
import { EquipmentItemNotFoundError } from "../domain/errors";
import type { EquipmentCatalogue } from "../ports/outbound/equipment-catalogue";

export interface UpdateEquipmentStockCommand {
  readonly equipmentItemId: string;
  readonly quantity: number;
  readonly location: string;
}

export interface UpdateEquipmentStockResult {
  readonly equipmentItemId: string;
  readonly quantity: number;
  readonly location: string;
}

export interface UpdateEquipmentStockDeps {
  readonly equipment: EquipmentCatalogue;
}

/** SPM-40 AC2: Technical Support Staff correct an existing line's quantity and location. */
export class UpdateEquipmentStockUseCase {
  constructor(private readonly deps: UpdateEquipmentStockDeps) {}

  /** Throws `EquipmentItemNotFoundError` when no such line exists. */
  async execute(command: UpdateEquipmentStockCommand): Promise<UpdateEquipmentStockResult> {
    const { equipment } = this.deps;
    const id = equipmentItemId(command.equipmentItemId);

    const existing = await equipment.findById(id);
    if (existing === null) {
      throw new EquipmentItemNotFoundError(command.equipmentItemId);
    }

    const updated = updateEquipmentStock(existing, command);
    await equipment.save(updated);

    return { equipmentItemId: updated.id, quantity: updated.quantity, location: updated.location };
  }
}
