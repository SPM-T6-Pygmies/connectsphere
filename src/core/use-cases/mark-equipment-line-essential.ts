import { equipmentItemId } from "../domain/equipment-item";
import { markEquipmentLineEssential } from "../domain/equipment-requirement";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import { assignedEvent, existingLine } from "./equipment-requirement-change";
import type { EquipmentRequirementDeps } from "./record-equipment-requirement";

export interface MarkEquipmentLineEssentialCommand {
  readonly eventId: string;
  /** The Event Coordinator marking the line. */
  readonly userAccountId: string;
  readonly equipmentItemId: string;
  readonly essential: boolean;
}

/**
 * SPM-109 AC1-AC2: the assigned Event Coordinator marks a line essential or
 * not, once agreed with Technical Support. How they agree happens outside the
 * system; the mark records the outcome.
 */
export class MarkEquipmentLineEssentialUseCase {
  constructor(private readonly deps: EquipmentRequirementDeps) {}

  /** Throws `EventNotFoundError` both for no such event and for one not assigned to this caller (#91). */
  async execute(command: MarkEquipmentLineEssentialCommand): Promise<void> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);
    const caller = userAccountId(command.userAccountId);
    const event = await assignedEvent(events, id, caller);

    const { line } = existingLine(await equipment.forEvent(id), equipmentItemId(command.equipmentItemId));
    await equipment.markEssential(id, markEquipmentLineEssential(event, line, command.essential), caller);
  }
}
