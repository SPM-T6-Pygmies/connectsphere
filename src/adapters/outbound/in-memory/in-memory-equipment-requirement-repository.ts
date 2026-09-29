import type { EquipmentCatalogueItem, EquipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import type { EventId } from "@/core/domain/event";
import type {
  EquipmentRequirementRepository,
  EventEquipment,
} from "@/core/ports/outbound/equipment-requirement-repository";

/** Takes the acting coordinator on writes, as the port does, but has no audit trail to record it in. */
export class InMemoryEquipmentRequirementRepository implements EquipmentRequirementRepository {
  private readonly items: readonly EquipmentCatalogueItem[];
  private readonly events = new Map<string, EventEquipment>();
  private opened = 0;

  constructor(
    catalogue: readonly EquipmentCatalogueItem[] = [],
    seed: Readonly<Record<string, EventEquipment>> = {},
  ) {
    this.items = [...catalogue];
    for (const [eventId, equipment] of Object.entries(seed)) {
      this.events.set(eventId, equipment);
    }
  }

  async catalogue(): Promise<readonly EquipmentCatalogueItem[]> {
    return this.items;
  }

  async forEvent(eventId: EventId): Promise<EventEquipment> {
    return this.equipmentOf(eventId);
  }

  async add(eventId: EventId, line: EquipmentRequirement): Promise<string> {
    const current = this.equipmentOf(eventId);
    const reservation = current.reservation ?? {
      id: `reservation-${++this.opened}`,
      reviewerUserAccountId: null,
    };
    this.events.set(eventId, { reservation, lines: [...current.lines, line] });
    return reservation.id;
  }

  async update(eventId: EventId, line: EquipmentRequirement): Promise<void> {
    const current = this.equipmentOf(eventId);
    this.events.set(eventId, {
      ...current,
      lines: current.lines.map((existing) =>
        existing.equipmentItemId === line.equipmentItemId ? line : existing,
      ),
    });
  }

  async delete(eventId: EventId, equipmentItemId: EquipmentItemId): Promise<void> {
    const current = this.equipmentOf(eventId);
    this.events.set(eventId, {
      ...current,
      lines: current.lines.filter((line) => line.equipmentItemId !== equipmentItemId),
    });
  }

  /** Test-only window on what was stored for an event. */
  stored(eventId: string): EventEquipment {
    return this.equipmentOf(eventId);
  }

  private equipmentOf(eventId: string): EventEquipment {
    return this.events.get(eventId) ?? { reservation: null, lines: [] };
  }
}
