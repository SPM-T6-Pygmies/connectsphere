import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import type { EquipmentCatalogueItem } from "../domain/equipment-item";
import { equipmentRequirementsEditable, isReserved } from "../domain/equipment-requirement";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { EquipmentRequirementDeps } from "./record-equipment-requirement";

export interface ViewEventEquipmentCommand {
  readonly eventId: string;
  readonly userAccountId: string;
}

export interface EquipmentLineView {
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly quantityRequested: number;
  readonly quantityReserved: number;
  readonly technicalRequirements: string | null;
  readonly reserved: boolean;
  readonly underReview: boolean;
  readonly removalRequested: boolean;
}

export interface ViewEventEquipmentResult {
  readonly event: {
    readonly id: string;
    readonly name: string;
    readonly status: CoordinatorEventStatus;
  };
  /** False on a Completed or Cancelled event, whose lines are read-only (AC13). */
  readonly editable: boolean;
  /** The Organiser's originally stated equipment needs, shown beside the lines as context (AC6). */
  readonly statedEquipmentNeeds: string | null;
  readonly lines: readonly EquipmentLineView[];
  /** What a new line's type can be picked from (AC1). */
  readonly catalogue: readonly EquipmentCatalogueItem[];
}

/**
 * SPM-41: an event's equipment requirement lines, to its assigned Event
 * Coordinator, with the catalogue to add from. Decides nothing, so it takes
 * the thin read path (ARCHITECTURE.md §11) apart from the access check.
 */
export class ViewEventEquipmentUseCase {
  constructor(private readonly deps: EquipmentRequirementDeps) {}

  /** Null when there is no such event, or it isn't assigned to this caller (#91). */
  async execute(command: ViewEventEquipmentCommand): Promise<ViewEventEquipmentResult | null> {
    const { events, equipment } = this.deps;
    const id = eventId(command.eventId);

    const event = await events.findById(id);
    if (event === null || event.assignedCoordinatorUserAccountId !== userAccountId(command.userAccountId)) {
      return null;
    }

    const [catalogue, current] = await Promise.all([equipment.catalogue(), equipment.forEvent(id)]);
    const typeOf = new Map(catalogue.map((item) => [item.id, item.type]));

    return {
      event: { id: event.id, name: event.name, status: event.status },
      editable: equipmentRequirementsEditable(event.status),
      statedEquipmentNeeds: event.statedEquipmentNeeds,
      lines: current.lines.map((line) => ({
        equipmentItemId: line.equipmentItemId,
        equipmentType: typeOf.get(line.equipmentItemId) ?? line.equipmentItemId,
        quantityRequested: line.quantityRequested,
        quantityReserved: line.quantityReserved,
        technicalRequirements: line.technicalRequirements,
        reserved: isReserved(line),
        underReview: line.state === "Under review",
        removalRequested: line.removalRequested,
      })),
      catalogue,
    };
  }
}
