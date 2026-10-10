import { unitsInService } from "../domain/equipment-item";
import type { EquipmentCatalogue } from "../ports/outbound/equipment-catalogue";

/** One line of the catalogue as the screen shows it -- plain data. */
export interface EquipmentCatalogueEntry {
  readonly id: string;
  readonly type: string;
  readonly description: string | null;
  /** How many are owned, in service or not. */
  readonly quantity: number;
  readonly location: string;
  /** SPM-17 AC3. */
  readonly outOfService: number;
  /** SPM-17 AC3: owned, less out of service. */
  readonly inService: number;
}

export interface ListEquipmentCatalogueResult {
  readonly items: readonly EquipmentCatalogueEntry[];
}

export interface ListEquipmentCatalogueDeps {
  readonly equipment: EquipmentCatalogue;
}

/**
 * SPM-40: what ConnectSphere currently owns. A thin read slice
 * (ARCHITECTURE.md section 11) -- nothing in the domain decides anything
 * about this list, so it is one port call.
 */
export class ListEquipmentCatalogueUseCase {
  constructor(private readonly deps: ListEquipmentCatalogueDeps) {}

  async execute(): Promise<ListEquipmentCatalogueResult> {
    const items = await this.deps.equipment.list();
    return { items: items.map((item) => ({ ...item, inService: unitsInService(item) })) };
  }
}
