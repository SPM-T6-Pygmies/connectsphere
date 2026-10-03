import { recheckReason, type RecheckReason } from "../domain/equipment-requirement";
import { userAccountId } from "../domain/user-account";
import type { EquipmentRecheckRepository } from "../ports/outbound/equipment-recheck-repository";

/** One line on Technical Support's "Needs re-check" list (SPM-41 AC15). */
export interface EquipmentRecheck {
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  readonly quantityRequested: number;
  readonly quantityReserved: number;
  /** Whether the coordinator changed the line or asked for it to be removed. */
  readonly reason: RecheckReason;
}

export interface ListEquipmentRechecksCommand {
  /** The Technical Support Staff member reading the list. */
  readonly userAccountId: string;
}

export interface ListEquipmentRechecksResult {
  readonly rechecks: readonly EquipmentRecheck[];
}

export interface ListEquipmentRechecksDeps {
  readonly rechecks: EquipmentRecheckRepository;
}

/**
 * SPM-41 AC15: the equipment lines Technical Support Staff must re-check
 * because a coordinator changed them after equipment was reserved, or asked
 * for their removal. The caller is the page's Technical Support context --
 * `technicalSupportContextFor` gives none to anyone else (AC16). Decides
 * nothing beyond the reason, so it takes the thin read path (ARCHITECTURE.md §11).
 */
export class ListEquipmentRechecksUseCase {
  constructor(private readonly deps: ListEquipmentRechecksDeps) {}

  async execute(command: ListEquipmentRechecksCommand): Promise<ListEquipmentRechecksResult> {
    const flagged = await this.deps.rechecks.flaggedLines(userAccountId(command.userAccountId));

    return {
      rechecks: flagged.flatMap(({ event, equipmentType, line }) => {
        const reason = recheckReason(line);
        return reason === null
          ? []
          : [
              {
                eventId: event.id,
                eventName: event.name,
                preferredDate: event.preferredDate,
                equipmentItemId: line.equipmentItemId,
                equipmentType,
                quantityRequested: line.quantityRequested,
                quantityReserved: line.quantityReserved,
                reason,
              },
            ];
      }),
    };
  }
}
