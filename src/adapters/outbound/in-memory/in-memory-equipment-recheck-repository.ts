import { recheckReason } from "@/core/domain/equipment-requirement";
import type {
  EquipmentRecheckRepository,
  UnderReviewEquipmentLine,
} from "@/core/ports/outbound/equipment-recheck-repository";

/**
 * Seeded with every line of every event, under review or not, and returns the
 * ones under review in the order seeded -- as the real store returns only what
 * a coordinator's change put under review. It does not check who is reading: that is the
 * real store's re-check, and the use case's context already gates the page.
 */
export class InMemoryEquipmentRecheckRepository implements EquipmentRecheckRepository {
  private readonly lines: readonly UnderReviewEquipmentLine[];

  constructor(seed: readonly UnderReviewEquipmentLine[] = []) {
    this.lines = [...seed];
  }

  async linesUnderReview(): Promise<readonly UnderReviewEquipmentLine[]> {
    return this.lines.filter((entry) => recheckReason(entry.line) !== null);
  }
}
