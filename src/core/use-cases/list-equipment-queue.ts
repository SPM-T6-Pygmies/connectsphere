import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { attentionReason, equipmentQueueOf, type EquipmentQueue } from "../domain/equipment-review";
import { userAccountId } from "../domain/user-account";
import type { TechnicalEquipmentRepository } from "../ports/outbound/technical-equipment-repository";

/** One event on a Technical Support list (SPM-273 AC1). */
export interface EquipmentQueueEntry {
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly status: CoordinatorEventStatus;
  readonly lineCount: number;
  /** How many of its lines are new, changed or have their removal requested. */
  readonly linesNeedingAttention: number;
}

export interface ListEquipmentQueueCommand {
  /** The Technical Support Staff member reading the list. */
  readonly userAccountId: string;
  readonly queue: EquipmentQueue;
}

export interface ListEquipmentQueueResult {
  readonly events: readonly EquipmentQueueEntry[];
}

export interface ListEquipmentQueueDeps {
  readonly equipment: TechnicalEquipmentRepository;
}

/**
 * SPM-273: the events on one of Technical Support's lists -- Needs review,
 * Reviewed or Archive. The caller is the page's Technical Support context,
 * which gives none to anyone else. Which list an event is on is
 * `equipmentQueueOf`'s call, not this one's.
 */
export class ListEquipmentQueueUseCase {
  constructor(private readonly deps: ListEquipmentQueueDeps) {}

  async execute(command: ListEquipmentQueueCommand): Promise<ListEquipmentQueueResult> {
    const events = await this.deps.equipment.eventsWithEquipment(userAccountId(command.userAccountId));

    return {
      events: events
        .filter(({ event, lines }) => equipmentQueueOf(event.status, lines) === command.queue)
        .map(({ event, lines }) => ({
          eventId: event.id,
          eventName: event.name,
          preferredDate: event.preferredDate,
          status: event.status,
          lineCount: lines.length,
          linesNeedingAttention: lines.filter((line) => attentionReason(line) !== null).length,
        })),
    };
  }
}
