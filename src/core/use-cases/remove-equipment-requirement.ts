import { equipmentItemId } from "../domain/equipment-item";
import { removeEquipmentRequirement } from "../domain/equipment-requirement";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import { assignedEvent } from "./assigned-event";
import {
  catalogueItem,
  describeChange,
  existingLine,
  type EquipmentRequirementChange,
} from "./equipment-requirement-change";
import type { EquipmentAttentionDeps, EquipmentRequirementChangeDeps } from "./record-equipment-requirement";

export interface RemoveEquipmentRequirementCommand {
  readonly eventId: string;
  /** The Event Coordinator removing the line. */
  readonly userAccountId: string;
  readonly equipmentItemId: string;
}

/**
 * SPM-41 AC10-11: the assigned Event Coordinator removes a line. An unreserved
 * line is deleted; a reserved one stays, marked removal requested and under review,
 * until Technical Support release its equipment (SPM-108).
 */
export class RemoveEquipmentRequirementUseCase {
  constructor(private readonly deps: EquipmentRequirementChangeDeps & EquipmentAttentionDeps) {}

  /** Throws `EventNotFoundError` both for no such event and for one not assigned to this caller (#91). */
  async execute(command: RemoveEquipmentRequirementCommand): Promise<EquipmentRequirementChange> {
    // SPM-262 AC2: this change can complete the event's equipment.
    return this.deps.safetyCheck.around({ eventId: eventId(command.eventId) }, () => this.change(command));
  }

  private async change(command: RemoveEquipmentRequirementCommand): Promise<EquipmentRequirementChange> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);
    const caller = userAccountId(command.userAccountId);
    const event = await assignedEvent(events, id, caller);

    const [catalogue, current] = await Promise.all([equipment.catalogue(), equipment.forEvent(id)]);
    const itemId = equipmentItemId(command.equipmentItemId);
    const { line, reservation } = existingLine(current, itemId);
    const removal = removeEquipmentRequirement(event, line);

    const item = catalogueItem(catalogue, itemId);
    const after = removal.kind === "deleted" ? null : removal.line;
    if (removal.kind === "deleted") {
      await equipment.delete(id, itemId, caller);
    } else {
      await equipment.update(id, removal.line, caller);
    }
    // SPM-64 AC1: Technical Support hear of a deleted line as well as a removal request.
    await this.deps.attention.announce({ event, equipmentType: item.type, change: removal.kind, before: line, after });

    return describeChange({
      action: removal.kind,
      event,
      reservation,
      item,
      before: line,
      after,
      changed: true,
      underReview: removal.kind === "removalRequested",
    });
  }
}
