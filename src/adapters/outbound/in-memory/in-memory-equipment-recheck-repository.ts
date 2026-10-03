import { recheckReason } from "@/core/domain/equipment-requirement";
import type {
  EquipmentRecheckRepository,
  FlaggedEquipmentLine,
} from "@/core/ports/outbound/equipment-recheck-repository";

/**
 * Seeded with every line of every event, flagged or not, and returns the
 * flagged ones in the order seeded -- as the real store returns only what a
 * coordinator's change flagged. It does not check who is reading: that is the
 * real store's re-check, and the use case's context already gates the page.
 */
export class InMemoryEquipmentRecheckRepository implements EquipmentRecheckRepository {
  private readonly lines: readonly FlaggedEquipmentLine[];

  constructor(seed: readonly FlaggedEquipmentLine[] = []) {
    this.lines = [...seed];
  }

  async flaggedLines(): Promise<readonly FlaggedEquipmentLine[]> {
    return this.lines.filter((entry) => recheckReason(entry.line) !== null);
  }
}
