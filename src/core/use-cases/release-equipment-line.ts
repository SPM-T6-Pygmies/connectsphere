import { releaseEquipmentLine } from "../domain/equipment-review";
import { EquipmentNothingToReleaseError, EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import type { TechnicalEquipmentRepository } from "../ports/outbound/technical-equipment-repository";
import type { EquipmentOutcomeAnnouncer } from "./announce-equipment-outcome";

export interface ReleaseEquipmentLineCommand {
  readonly eventId: string;
  readonly equipmentItemId: string;
  /** The Technical Support Staff member releasing it. */
  readonly userAccountId: string;
}

export interface ReleaseEquipmentLineResult {
  readonly eventId: string;
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly state: "Released";
  readonly quantityReleased: number;
}

export interface ReleaseEquipmentLineDeps {
  readonly equipment: TechnicalEquipmentRepository;
  /** SPM-65: releasing the last line needing attention finishes the event's equipment. */
  readonly outcome: Pick<EquipmentOutcomeAnnouncer, "around">;
}

/**
 * SPM-108: Technical Support release the units held on a line the
 * coordinator asked to remove, so they go back into the pool for other events
 * (AC2), and the line leaves their list (AC1). The event's other lines are
 * untouched.
 */
export class ReleaseEquipmentLineUseCase {
  constructor(private readonly deps: ReleaseEquipmentLineDeps) {}

  async execute(command: ReleaseEquipmentLineCommand): Promise<ReleaseEquipmentLineResult> {
    const reviewer = userAccountId(command.userAccountId);
    return this.deps.outcome.around(reviewer, eventId(command.eventId), () => this.release(reviewer, command));
  }

  private async release(
    reviewer: UserAccountId,
    command: ReleaseEquipmentLineCommand,
  ): Promise<ReleaseEquipmentLineResult> {
    const { equipment } = this.deps;

    const found = await equipment.eventEquipment(reviewer, eventId(command.eventId));
    if (found === null) {
      throw new EventNotFoundError(command.eventId);
    }
    const target = found.lines.find(({ line }) => line.equipmentItemId === command.equipmentItemId);
    if (target === undefined) {
      // Released already, from another tab or by a colleague (AC3).
      throw new EquipmentNothingToReleaseError();
    }

    const quantityReleased = releaseEquipmentLine(found.event.status, target.line);
    await equipment.release(reviewer, found.event.id, target.line);

    return {
      eventId: found.event.id,
      equipmentItemId: target.line.equipmentItemId,
      equipmentType: target.equipmentType,
      state: "Released",
      quantityReleased,
    };
  }
}
