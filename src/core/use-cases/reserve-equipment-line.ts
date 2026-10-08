import { reserveEquipmentLine } from "../domain/equipment-review";
import { userAccountId } from "../domain/user-account";
import type { TechnicalEquipmentRepository } from "../ports/outbound/technical-equipment-repository";
import { lineToDecide, type EquipmentLineDecisionResult } from "./equipment-line-decision";

export interface ReserveEquipmentLineCommand {
  readonly eventId: string;
  readonly equipmentItemId: string;
  /** The Technical Support Staff member reserving. */
  readonly userAccountId: string;
}

export interface ReserveEquipmentLineDeps {
  readonly equipment: TechnicalEquipmentRepository;
}

/**
 * SPM-274 AC1: Technical Support reserve the full quantity a line requests,
 * which holds those units against every other event over the same days (AC5).
 * Refused before the event has a date (AC2) or with too few units free (AC3),
 * judged when they reserve, not when the page opened (AC6).
 */
export class ReserveEquipmentLineUseCase {
  constructor(private readonly deps: ReserveEquipmentLineDeps) {}

  async execute(command: ReserveEquipmentLineCommand): Promise<EquipmentLineDecisionResult> {
    const { equipment } = this.deps;
    const reviewer = userAccountId(command.userAccountId);

    const { event, target } = await lineToDecide(equipment, reviewer, command);
    const reserved = reserveEquipmentLine(event, target, reviewer);
    await equipment.reserve(reviewer, event.id, reserved);

    return {
      eventId: event.id,
      equipmentItemId: reserved.equipmentItemId,
      equipmentType: target.equipmentType,
      state: reserved.state,
      quantityReserved: reserved.quantityReserved,
    };
  }
}
