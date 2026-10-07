import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import type { EquipmentReviewBaseline } from "../domain/equipment-requirement";
import {
  attentionReason,
  equipmentQueueOf,
  reservedAs,
  unitsAvailable,
  type AttentionReason,
  type EquipmentQueue,
} from "../domain/equipment-review";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { TechnicalEquipmentRepository } from "../ports/outbound/technical-equipment-repository";

export interface ViewEventEquipmentForTechnicalSupportCommand {
  readonly eventId: string;
  /** The Technical Support Staff member reading the event. */
  readonly userAccountId: string;
}

/** One equipment line, as Technical Support see it (SPM-273 AC3, AC4). */
export interface TechnicalSupportEquipmentLine {
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly quantityRequested: number;
  readonly quantityReserved: number;
  readonly technicalRequirements: string | null;
  /** Why the line needs attention, or null when it does not. */
  readonly attention: AttentionReason | null;
  /** What the line was when it was reserved, while that differs from now. */
  readonly reservedAs: EquipmentReviewBaseline | null;
  /** Units free on the event's date; null while the event has no date. */
  readonly available: number | null;
}

export interface ViewEventEquipmentForTechnicalSupportResult {
  readonly event: {
    readonly id: string;
    readonly name: string;
    readonly status: CoordinatorEventStatus;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
  };
  /** Which list the event is on, so the page can open that one beside it. */
  readonly queue: EquipmentQueue | null;
  readonly lines: readonly TechnicalSupportEquipmentLine[];
}

export interface ViewEventEquipmentForTechnicalSupportDeps {
  readonly equipment: TechnicalEquipmentRepository;
}

/**
 * SPM-273 AC3-4: every equipment line of one event, marked with why it needs
 * attention, and with how many units are free on the event's date. Read-only:
 * acting on a line is SPM-274 and SPM-108.
 */
export class ViewEventEquipmentForTechnicalSupportUseCase {
  constructor(private readonly deps: ViewEventEquipmentForTechnicalSupportDeps) {}

  /** Null when there is no such event. */
  async execute(
    command: ViewEventEquipmentForTechnicalSupportCommand,
  ): Promise<ViewEventEquipmentForTechnicalSupportResult | null> {
    const found = await this.deps.equipment.eventEquipment(
      userAccountId(command.userAccountId),
      eventId(command.eventId),
    );
    if (found === null) {
      return null;
    }

    const { event, lines } = found;
    return {
      event: { id: event.id, name: event.name, status: event.status, preferredDate: event.preferredDate },
      queue: equipmentQueueOf(event.status, lines.map(({ line }) => line)),
      lines: lines.map(({ line, equipmentType, owned, otherHolds }) => ({
        equipmentItemId: line.equipmentItemId,
        equipmentType,
        quantityRequested: line.quantityRequested,
        quantityReserved: line.quantityReserved,
        technicalRequirements: line.technicalRequirements,
        attention: attentionReason(line),
        reservedAs: reservedAs(line),
        available: unitsAvailable(owned, event.preferredDate, otherHolds),
      })),
    };
  }
}
