import type { EquipmentRequirement } from "../../domain/equipment-requirement";
import type { EventId } from "../../domain/event";
import type { UserAccountId } from "../../domain/user-account";

/** One equipment line, with the event it belongs to and its type's name, as Technical Support see it. */
export interface UnderReviewEquipmentLine {
  readonly event: {
    readonly id: EventId;
    readonly name: string;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
  };
  readonly equipmentType: string;
  readonly line: EquipmentRequirement;
}

/**
 * Driven port: the equipment lines a coordinator's change put under
 * review for Technical Support to re-check (SPM-41 AC15). A separate port from
 * `EquipmentRequirementRepository`: that one serves the coordinator, one event
 * at a time; this one serves Technical Support, across every event.
 */
export interface EquipmentRecheckRepository {
  /**
   * Every line under review, soonest event first. Takes the reader so a store can
   * re-check they are Technical Support Staff at the moment it reads (AC16), as
   * the coordinator's writes re-check the coordinator.
   */
  linesUnderReview(reader: UserAccountId): Promise<readonly UnderReviewEquipmentLine[]>;
}
