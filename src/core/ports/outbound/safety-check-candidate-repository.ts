import type { SafetyCheckCandidate } from "../../domain/safety-check";
import type { UserAccountId } from "../../domain/user-account";

/**
 * Driven port: the events that might be awaiting a safety check, with the
 * bookings and equipment lines `awaitsSafetyCheck` judges them on (SPM-259).
 */
export interface SafetyCheckCandidateRepository {
  /**
   * Every Planning event, soonest first and undated last. Takes the reader so a
   * store can re-check they are a Safety Officer at the moment it reads (AC7).
   */
  candidates(reader: UserAccountId): Promise<readonly SafetyCheckCandidate[]>;
}
