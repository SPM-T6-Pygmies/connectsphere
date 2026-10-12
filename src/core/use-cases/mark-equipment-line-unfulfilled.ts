import { markEquipmentLineUnfulfilled } from "../domain/equipment-review";
import { userAccountId } from "../domain/user-account";
import type { TechnicalEquipmentRepository } from "../ports/outbound/technical-equipment-repository";
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
}

/**
 * SPM-274 AC3: with too few units free, Technical Support mark the line
 * unfulfilled with a comment, reserving nothing. It leaves their list, and the
 * coordinator sees why and who said so. The event's other lines are untouched.
 */
export class MarkEquipmentLineUnfulfilledUseCase {
  constructor(private readonly deps: MarkEquipmentLineUnfulfilledDeps) {}

  async execute(command: MarkEquipmentLineUnfulfilledCommand): Promise<EquipmentLineDecisionResult> {
    const { equipment } = this.deps;
    const reviewer = userAccountId(command.userAccountId);

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
