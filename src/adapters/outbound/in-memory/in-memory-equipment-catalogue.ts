import {
  equipmentItemId,
  type EquipmentItem,
  type EquipmentItemId,
  type NewEquipmentItem,
} from "@/core/domain/equipment-item";
import type { EventReservation } from "@/core/domain/equipment-review";
import type { EquipmentCatalogue } from "@/core/ports/outbound/equipment-catalogue";

/**
 * A real implementation of the port over a `Map`, not a mock: the test double
 * for the catalogue use-case tests. The running app uses
 * `SupabaseEquipmentCatalogue` (SPM-17 AC5).
 */
export class InMemoryEquipmentCatalogue implements EquipmentCatalogue {
  private readonly rows = new Map<EquipmentItemId, EquipmentItem>();
  private sequence = 0;

  /** `reservations` are keyed by item id -- `equipment-1` for the first item seeded, and so on. */
  constructor(
    seed: readonly NewEquipmentItem[] = [],
    private readonly reservations: Readonly<Record<string, readonly EventReservation[]>> = {},
  ) {
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

  async reservationsOf(id: EquipmentItemId): Promise<readonly EventReservation[]> {
    return this.reservations[id] ?? [];
  }

  private insert(item: NewEquipmentItem): EquipmentItem {
    this.sequence += 1;
    const stored: EquipmentItem = { id: equipmentItemId(`equipment-${this.sequence}`), ...item };
    this.rows.set(stored.id, stored);
    return stored;
  }
}
