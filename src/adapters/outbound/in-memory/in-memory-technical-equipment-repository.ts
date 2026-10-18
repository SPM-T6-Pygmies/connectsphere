import type { EquipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { awaitsDecision, unitsAvailable, type EquipmentHold } from "@/core/domain/equipment-review";
import {
  EquipmentLineNotAwaitingDecisionError,
  EquipmentRequirementNotFoundError,
  EventNotFoundError,
  NotEnoughEquipmentAvailableError,
} from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EquipmentLineStock,
  EventEquipmentStock,
  EventWithEquipment,
  TechnicalEquipmentRepository,
} from "@/core/ports/outbound/technical-equipment-repository";

/**
 * Seeded with each event's lines and the stock beside them; returns them in
 * the order seeded. A line's `otherHolds` are the seeded ones plus whatever
 * the store's other events have reserved of its type, so a reservation made
 * here is held against every other event, as in the real store (SPM-274 AC5).
 * It does not check who is reading or writing: that is the real store's
 * re-check, and the page's Technical Support context already gates the lists.
 * A decision is credited to its reviewer by `names`, as the real store reads
 * the decider's name back (SPM-274).
 */
export class InMemoryTechnicalEquipmentRepository implements TechnicalEquipmentRepository {
  private readonly events: EventEquipmentStock[];

  constructor(
    seed: readonly EventEquipmentStock[] = [],
    private readonly names: Readonly<Record<string, string>> = {},
  ) {
    this.events = [...seed];
  }

  async eventsWithEquipment(): Promise<readonly EventWithEquipment[]> {
    return this.events
      .filter((entry) => entry.lines.length > 0)
      .map(({ event, lines }) => ({ event, lines: lines.map(({ line }) => line) }));
  }

  async eventEquipment(_reader: UserAccountId, eventId: EventId): Promise<EventEquipmentStock | null> {
    const entry = this.events.find((candidate) => candidate.event.id === eventId);
    if (entry === undefined) {
      return null;
    }
    return {
      event: entry.event,
      lines: entry.lines.map((stock) => ({ ...stock, otherHolds: this.holdsAgainst(eventId, stock) })),
    };
  }

  async reserve(reviewer: UserAccountId, eventId: EventId, line: EquipmentRequirement): Promise<void> {
    const { entry, stock } = this.awaitingLine(eventId, line);
    const available = unitsAvailable(
      stock.owned,
      stock.outOfService,
      entry.event.preferredDate,
      this.holdsAgainst(eventId, stock),
    );
    if (available !== null && available < line.quantityReserved) {
      throw new NotEnoughEquipmentAvailableError(available, line.quantityReserved);
    }
    this.replace(eventId, line, reviewer);
  }

  async markUnfulfilled(reviewer: UserAccountId, eventId: EventId, line: EquipmentRequirement): Promise<void> {
    this.awaitingLine(eventId, line);
    this.replace(eventId, line, reviewer);
  }

  /** The stored line `line` decides on, if it still awaits that decision as it was read. */
  private awaitingLine(eventId: EventId, line: EquipmentRequirement) {
    const entry = this.events.find((candidate) => candidate.event.id === eventId);
    if (entry === undefined) {
      throw new EventNotFoundError(eventId);
    }
    const stock = entry.lines.find((candidate) => candidate.line.equipmentItemId === line.equipmentItemId);
    if (stock === undefined) {
      throw new EquipmentRequirementNotFoundError(line.equipmentItemId);
    }
    if (!awaitsDecision(entry.event.status, stock.line) || stock.line.quantityRequested !== line.quantityRequested) {
      throw new EquipmentLineNotAwaitingDecisionError();
    }
    return { entry, stock };
  }

  private holdsAgainst(eventId: EventId, stock: EquipmentLineStock): readonly EquipmentHold[] {
    return [...stock.otherHolds, ...this.storedHolds(eventId, stock.line.equipmentItemId)];
  }

  private storedHolds(exceptEventId: EventId, item: EquipmentItemId): EquipmentHold[] {
    return this.events.flatMap(({ event, lines }) =>
      event.id === exceptEventId
        ? []
        : lines
            .filter(({ line }) => line.equipmentItemId === item && line.quantityReserved > 0)
            .map(({ line }) => ({
              eventStatus: event.status,
              eventDate: event.preferredDate,
              quantityReserved: line.quantityReserved,
            })),
    );
  }

  private replace(eventId: EventId, line: EquipmentRequirement, decidedBy: UserAccountId): void {
    const index = this.events.findIndex((candidate) => candidate.event.id === eventId);
    const entry = this.events[index];
    const decidedByName = this.names[decidedBy] ?? null;
    this.events[index] = {
      ...entry,
      lines: entry.lines.map((stock) =>
        stock.line.equipmentItemId === line.equipmentItemId ? { ...stock, line, decidedByName } : stock,
      ),
    };
  }
}
