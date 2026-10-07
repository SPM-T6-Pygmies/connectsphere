import type {
  EventWithEquipment,
  TechnicalEquipmentRepository,
} from "@/core/ports/outbound/technical-equipment-repository";

/**
 * Returns the seeded events that have equipment lines, in the order seeded. It
 * does not check who is reading: that is the real store's re-check, and the
 * page's Technical Support context already gates the lists.
 */
export class InMemoryTechnicalEquipmentRepository implements TechnicalEquipmentRepository {
  private readonly events: readonly EventWithEquipment[];

  constructor(seed: readonly EventWithEquipment[] = []) {
    this.events = [...seed];
  }

  async eventsWithEquipment(): Promise<readonly EventWithEquipment[]> {
    return this.events.filter((entry) => entry.lines.length > 0);
  }
}
