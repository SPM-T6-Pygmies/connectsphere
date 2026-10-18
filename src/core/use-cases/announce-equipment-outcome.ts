import { finishesReview } from "../domain/equipment-review";
import type { EventId } from "../domain/event";
import type { UserAccountId } from "../domain/user-account";
import type { EquipmentNoticeDirectory } from "../ports/outbound/equipment-notice-directory";
import type { EquipmentLineOutcome, Notifier } from "../ports/outbound/notifier";
import type {
  EquipmentLineStock,
  EventEquipmentStock,
  TechnicalEquipmentRepository,
} from "../ports/outbound/technical-equipment-repository";

export interface EquipmentOutcomeAnnouncerDeps {
  readonly equipment: Pick<TechnicalEquipmentRepository, "eventEquipment">;
  readonly directory: Pick<EquipmentNoticeDirectory, "assignedCoordinator">;
  readonly notifier: Notifier;
}

function outcome({ line, equipmentType, decidedByName }: EquipmentLineStock): EquipmentLineOutcome {
  const unfulfilled = line.state === "Unfulfilled";
  return {
    equipmentType,
    quantityRequested: line.quantityRequested,
    outcome: unfulfilled ? "unfulfilled" : "reserved",
    quantityReserved: line.quantityReserved,
    decidedByName,
    comment: unfulfilled ? (line.decision?.comment ?? null) : null,
  };
}

/**
 * SPM-65: tells an event's assigned coordinator the outcome once Technical
 * Support's decision leaves nothing on the event needing their attention.
 * Wraps the decision rather than reading a status, because "finished" is
 * never stored -- `finishesReview` works it out from the lines before and
 * after. Reserving a line and marking it unfulfilled both run through here.
 */
export class EquipmentOutcomeAnnouncer {
  constructor(private readonly deps: EquipmentOutcomeAnnouncerDeps) {}

  async around<T>(reviewer: UserAccountId, eventId: EventId, decide: () => Promise<T>): Promise<T> {
    const before = await this.deps.equipment.eventEquipment(reviewer, eventId);
    const result = await decide();
    const after = await this.deps.equipment.eventEquipment(reviewer, eventId);

    if (
      before !== null &&
      after !== null &&
      finishesReview(
        before.lines.map(({ line }) => line),
        after.lines.map(({ line }) => line),
      )
    ) {
      await this.announce(after);
    }
    return result;
  }

  private async announce({ event, lines }: EventEquipmentStock): Promise<void> {
    const coordinator = await this.deps.directory.assignedCoordinator(event.id);
    if (coordinator === null) {
      return;
    }
    await this.deps.notifier.equipmentDecided({
      recipientUserAccountId: coordinator,
      eventId: event.id,
      eventName: event.name,
      preferredDate: event.preferredDate,
      lines: lines.map(outcome),
    });
  }
}
