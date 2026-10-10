import type { EquipmentLineState } from "../domain/equipment-requirement";
import { EquipmentRequirementNotFoundError, EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import type { UserAccountId } from "../domain/user-account";
import type {
  EquipmentLineStock,
  TechnicalEquipmentEvent,
  TechnicalEquipmentRepository,
} from "../ports/outbound/technical-equipment-repository";

/** What Technical Support decided on one line (SPM-274). */
export interface EquipmentLineDecisionResult {
  readonly eventId: string;
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly state: EquipmentLineState;
  readonly quantityReserved: number;
}

/**
 * The event and the line a decision is about, read afresh -- so what is free
 * is judged as it stands now, not as it stood when the page opened (AC6).
 */
export async function lineToDecide(
  equipment: TechnicalEquipmentRepository,
  reviewer: UserAccountId,
  command: { readonly eventId: string; readonly equipmentItemId: string },
): Promise<{ readonly event: TechnicalEquipmentEvent; readonly target: EquipmentLineStock }> {
  const found = await equipment.eventEquipment(reviewer, eventId(command.eventId));
  if (found === null) {
    throw new EventNotFoundError(command.eventId);
  }
  const target = found.lines.find(({ line }) => line.equipmentItemId === command.equipmentItemId);
  if (target === undefined) {
    throw new EquipmentRequirementNotFoundError(command.equipmentItemId);
  }
  return { event: found.event, target };
}
