import { newEquipmentItem } from "../domain/equipment-item";
import type { EquipmentCatalogue } from "../ports/outbound/equipment-catalogue";

export interface CreateEquipmentItemCommand {
  readonly type: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly location: string;
}

export interface CreateEquipmentItemResult {
  readonly equipmentItemId: string;
  readonly type: string;
  readonly quantity: number;
  readonly location: string;
}

export interface CreateEquipmentItemDeps {
  readonly equipment: EquipmentCatalogue;
}

/**
 * SPM-40 AC1: Technical Support Staff add a line to the equipment catalogue.
 *
 * What makes a record acceptable is `newEquipmentItem`'s call, not this
 * file's; this only sequences it against the catalogue.
 */
export class CreateEquipmentItemUseCase {
  constructor(private readonly deps: CreateEquipmentItemDeps) {}

  async execute(command: CreateEquipmentItemCommand): Promise<CreateEquipmentItemResult> {
    const created = await this.deps.equipment.create(newEquipmentItem(command));

    return {
      equipmentItemId: created.id,
      type: created.type,
      quantity: created.quantity,
      location: created.location,
    };
  }
}
