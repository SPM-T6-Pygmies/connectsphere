import { equipmentItemId } from "../domain/equipment-item";
import { recordEquipmentRequirement } from "../domain/equipment-requirement";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { EquipmentRequirementRepository } from "../ports/outbound/equipment-requirement-repository";
import {
  assignedEvent,
  catalogueItem,
  describeChange,
  type EquipmentRequirementChange,
} from "./equipment-requirement-change";

export interface RecordEquipmentRequirementCommand {
  readonly eventId: string;
  /** The Event Coordinator recording the line. */
  readonly userAccountId: string;
  readonly equipmentItemId: string;
  readonly quantityRequested: number;
  readonly technicalRequirements: string | null;
}

export interface EquipmentRequirementDeps {
  readonly events: CoordinatorEventRepository;
  readonly equipment: EquipmentRequirementRepository;
}

/**
 * SPM-41 AC1-5: the assigned Event Coordinator adds a line to an event's
 * equipment requirements. The first line opens the event's reservation.
 */
export class RecordEquipmentRequirementUseCase {
  constructor(private readonly deps: EquipmentRequirementDeps) {}

  /** Throws `EventNotFoundError` both for no such event and for one not assigned to this caller (#91). */
  async execute(command: RecordEquipmentRequirementCommand): Promise<EquipmentRequirementChange> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);
    const caller = userAccountId(command.userAccountId);
    const event = await assignedEvent(events, id, caller);

    const [catalogue, current] = await Promise.all([equipment.catalogue(), equipment.forEvent(id)]);
    const item = catalogueItem(catalogue, equipmentItemId(command.equipmentItemId));
    const line = recordEquipmentRequirement(event, current.lines, {
      equipmentItemId: item.id,
      quantityRequested: command.quantityRequested,
      technicalRequirements: command.technicalRequirements,
    });

    const reservationId = await equipment.add(id, line, caller);

    return describeChange({
      action: "recorded",
      event,
      reservation: {
        id: reservationId,
        reviewerUserAccountId: current.reservation?.reviewerUserAccountId ?? null,
      },
      item,
      before: null,
      after: line,
      changed: true,
      flagged: false,
    });
  }
}
