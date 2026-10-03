import { equipmentItemId } from "../domain/equipment-item";
import { undoEquipmentRemoval } from "../domain/equipment-requirement";
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

export interface UndoEquipmentRemovalCommand {
  readonly eventId: string;
  /** The Event Coordinator undoing the removal. */
  readonly userAccountId: string;
  readonly equipmentItemId: string;
}

/**
 * SPM-41 AC17: the assigned Event Coordinator takes back a removal Technical
 * Support have not yet acted on. The line stays under review.
 */
export class UndoEquipmentRemovalUseCase {
  constructor(private readonly deps: EquipmentRequirementDeps) {}

  /** Throws `EventNotFoundError` both for no such event and for one not assigned to this caller (#91). */
  async execute(command: UndoEquipmentRemovalCommand): Promise<EquipmentRequirementChange> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);
    const caller = userAccountId(command.userAccountId);
    const event = await assignedEvent(events, id, caller);

    const [catalogue, current] = await Promise.all([equipment.catalogue(), equipment.forEvent(id)]);
    const itemId = equipmentItemId(command.equipmentItemId);
    const { line, reservation } = existingLine(current, itemId);
    const restored = undoEquipmentRemoval(event, line);

    await equipment.update(id, restored, caller);

    return describeChange({
      action: "removalUndone",
      event,
      reservation,
      item: catalogueItem(catalogue, itemId),
      before: line,
      after: restored,
      changed: true,
      underReview: false,
    });
  }
}
