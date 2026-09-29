import { equipmentItemId } from "../domain/equipment-item";
import { removeEquipmentRequirement } from "../domain/equipment-requirement";
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

export interface RemoveEquipmentRequirementCommand {
  readonly eventId: string;
  /** The Event Coordinator removing the line. */
  readonly userAccountId: string;
  readonly equipmentItemId: string;
}

/**
 * SPM-41 AC10-11: the assigned Event Coordinator removes a line. An unreserved
 * line is deleted; a reserved one stays, marked removal requested and flagged,
 * until Technical Support release its equipment (SPM-108).
 */
export class RemoveEquipmentRequirementUseCase {
  constructor(private readonly deps: EquipmentRequirementDeps) {}

  /** Throws `EventNotFoundError` both for no such event and for one not assigned to this caller (#91). */
  async execute(command: RemoveEquipmentRequirementCommand): Promise<EquipmentRequirementChange> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);
    const caller = userAccountId(command.userAccountId);
    const event = await assignedEvent(events, id, caller);

    const [catalogue, current] = await Promise.all([equipment.catalogue(), equipment.forEvent(id)]);
    const itemId = equipmentItemId(command.equipmentItemId);
    const { line, reservation } = existingLine(current, itemId);
    const removal = removeEquipmentRequirement(event, line);

    if (removal.kind === "deleted") {
      await equipment.delete(id, itemId, caller);
    } else {
      await equipment.update(id, removal.line, caller);
    }

    return describeChange({
      action: removal.kind,
      event,
      reservation,
      item: catalogueItem(catalogue, itemId),
      before: line,
      after: removal.kind === "deleted" ? null : removal.line,
      changed: true,
      flagged: removal.kind === "removalRequested",
    });
  }
}
