import {
  equipmentItemId,
  type EquipmentItem,
  type EquipmentItemId,
  type NewEquipmentItem,
} from "@/core/domain/equipment-item";
import type { EquipmentCatalogue } from "@/core/ports/outbound/equipment-catalogue";

/**
 * A real implementation of the port over a `Map`, not a mock: it is the test
 * double for use-case tests, and for now also what the running app uses until
 * the Supabase adapter for `equipment_item` exists (see `src/composition`).
 */
export class InMemoryEquipmentCatalogue implements EquipmentCatalogue {
  private readonly rows = new Map<EquipmentItemId, EquipmentItem>();
  private sequence = 0;

  constructor(seed: readonly NewEquipmentItem[] = []) {
    for (const item of seed) {
      void this.insert(item);
    }
  }

  async list(): Promise<readonly EquipmentItem[]> {
    return [...this.rows.values()].sort((a, b) => a.type.localeCompare(b.type));
  }

  async findById(id: EquipmentItemId): Promise<EquipmentItem | null> {
    return this.rows.get(id) ?? null;
  }

  async create(item: NewEquipmentItem): Promise<EquipmentItem> {
    return this.insert(item);
  }

  async save(item: EquipmentItem): Promise<void> {
    if (!this.rows.has(item.id)) {
      throw new Error(`Cannot save equipment item ${item.id}: it was never created.`);
    }
    this.rows.set(item.id, item);
  }

  private insert(item: NewEquipmentItem): EquipmentItem {
    this.sequence += 1;
    const stored: EquipmentItem = { id: equipmentItemId(`equipment-${this.sequence}`), ...item };
    this.rows.set(stored.id, stored);
    return stored;
  }
}
