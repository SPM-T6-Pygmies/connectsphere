import { equipmentItemId } from "../domain/equipment-item";
import { editEquipmentRequirement } from "../domain/equipment-requirement";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import {
  assignedEvent,
  catalogueItem,
  describeChange,
  existingLine,
  type EquipmentRequirementChange,
} from "./equipment-requirement-change";
import type { EquipmentRequirementDeps } from "./record-equipment-requirement";

export interface EditEquipmentRequirementCommand {
  readonly eventId: string;
  /** The Event Coordinator editing the line. */
  readonly userAccountId: string;
  /** Which line: an event has at most one per catalogue item (AC2). */
  readonly equipmentItemId: string;
  readonly quantityRequested: number;
  readonly technicalRequirements: string | null;
}

/**
 * SPM-41 AC7-9: the assigned Event Coordinator changes a line's quantity or
 * technical requirements. A save that changes nothing is not stored.
 */
export class EditEquipmentRequirementUseCase {
  constructor(private readonly deps: EquipmentRequirementDeps) {}

  /** Throws `EventNotFoundError` both for no such event and for one not assigned to this caller (#91). */
  async execute(command: EditEquipmentRequirementCommand): Promise<EquipmentRequirementChange> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);
    const caller = userAccountId(command.userAccountId);
    const event = await assignedEvent(events, id, caller);

    const [catalogue, current] = await Promise.all([equipment.catalogue(), equipment.forEvent(id)]);
    const itemId = equipmentItemId(command.equipmentItemId);
    const { line, reservation } = existingLine(current, itemId);
    const edit = editEquipmentRequirement(event, line, {
      quantityRequested: command.quantityRequested,
      technicalRequirements: command.technicalRequirements,
    });

    if (edit.changed) {
      await equipment.update(id, edit.line, caller);
    }

    return describeChange({
      action: "edited",
      event,
      reservation,
      item: catalogueItem(catalogue, itemId),
      before: line,
      after: edit.line,
      changed: edit.changed,
      flagged: edit.flagged,
    });
  }
}
