import type { EventId } from "@/core/domain/event";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventEquipmentStock,
  EventWithEquipment,
  TechnicalEquipmentRepository,
} from "@/core/ports/outbound/technical-equipment-repository";

/**
 * Seeded with each event's lines and the stock beside them; returns them in
 * the order seeded. It does not check who is reading: that is the real store's
 * re-check, and the page's Technical Support context already gates the lists.
 */
export class InMemoryTechnicalEquipmentRepository implements TechnicalEquipmentRepository {
  private readonly events: readonly EventEquipmentStock[];

  constructor(seed: readonly EventEquipmentStock[] = []) {
    this.events = [...seed];
  }

  async eventsWithEquipment(): Promise<readonly EventWithEquipment[]> {
    return this.events
      .filter((entry) => entry.lines.length > 0)
      .map(({ event, lines }) => ({ event, lines: lines.map(({ line }) => line) }));
  }

  async eventEquipment(_reader: UserAccountId, eventId: EventId): Promise<EventEquipmentStock | null> {
    return this.events.find((entry) => entry.event.id === eventId) ?? null;
  }
}
