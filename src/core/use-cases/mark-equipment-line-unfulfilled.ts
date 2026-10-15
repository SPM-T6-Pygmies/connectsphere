import { markEquipmentLineUnfulfilled } from "../domain/equipment-review";
import { eventId } from "../domain/event";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import type { TechnicalEquipmentRepository } from "../ports/outbound/technical-equipment-repository";
import type { EquipmentOutcomeAnnouncer } from "./announce-equipment-outcome";
import { lineToDecide, type EquipmentLineDecisionResult } from "./equipment-line-decision";

export interface MarkEquipmentLineUnfulfilledCommand {
  readonly eventId: string;
  readonly equipmentItemId: string;
  /** The Technical Support Staff member marking it. */
  readonly userAccountId: string;
  /** Why it cannot be fulfilled, e.g. "only 3 available". */
  readonly comment: string;
}

export interface MarkEquipmentLineUnfulfilledDeps {
  readonly equipment: TechnicalEquipmentRepository;
  /** SPM-65: this decision can finish the event's equipment. */
  readonly outcome: Pick<EquipmentOutcomeAnnouncer, "around">;
}

/**
 * SPM-274 AC3: with too few units free, Technical Support mark the line
 * unfulfilled with a comment, reserving nothing. It leaves their list, and the
 * coordinator sees why and who said so. The event's other lines are untouched.
 */
export class MarkEquipmentLineUnfulfilledUseCase {
  constructor(private readonly deps: MarkEquipmentLineUnfulfilledDeps) {}

  async execute(command: MarkEquipmentLineUnfulfilledCommand): Promise<EquipmentLineDecisionResult> {
    const reviewer = userAccountId(command.userAccountId);
    return this.deps.outcome.around(reviewer, eventId(command.eventId), () => this.decide(reviewer, command));
  }

  private async decide(
    reviewer: UserAccountId,
    command: MarkEquipmentLineUnfulfilledCommand,
  ): Promise<EquipmentLineDecisionResult> {
    const { equipment } = this.deps;

    const { event, target } = await lineToDecide(equipment, reviewer, command);
    const marked = markEquipmentLineUnfulfilled(event, target, reviewer, command.comment);
    await equipment.markUnfulfilled(reviewer, event.id, marked);

    return {
      eventId: event.id,
      equipmentItemId: marked.equipmentItemId,
      equipmentType: target.equipmentType,
      state: marked.state,
      quantityReserved: marked.quantityReserved,
    };
  }
}
