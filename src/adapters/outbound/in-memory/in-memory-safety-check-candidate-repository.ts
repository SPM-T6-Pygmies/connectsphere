import type { SafetyCheckCandidate } from "@/core/domain/safety-check";
import type { SafetyCheckCandidateRepository } from "@/core/ports/outbound/safety-check-candidate-repository";

/**
 * Returns what it was seeded with, in the order seeded. It does not check who
 * is reading: that is the real store's re-check, and the page's Safety Officer
 * context already gates the list.
 */
export class InMemorySafetyCheckCandidateRepository implements SafetyCheckCandidateRepository {
  private readonly events: readonly SafetyCheckCandidate[];

  constructor(seed: readonly SafetyCheckCandidate[] = []) {
    this.events = [...seed];
  }

  async candidates(): Promise<readonly SafetyCheckCandidate[]> {
    return this.events;
  }
}
