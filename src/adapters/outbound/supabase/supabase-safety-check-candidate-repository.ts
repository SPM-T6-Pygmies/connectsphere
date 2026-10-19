import { NotSafetyOfficerError } from "@/core/domain/errors";
import type { SafetyCheckCandidate } from "@/core/domain/safety-check";
import type { UserAccountId } from "@/core/domain/user-account";
import type { SafetyCheckCandidateRepository } from "@/core/ports/outbound/safety-check-candidate-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import { expireLapsedHolds } from "./expire-lapsed-holds";
import {
  toSafetyCheckCandidate,
  toSafetyCheckCandidateError,
  type SafetyCheckCandidateRow,
} from "./safety-check-candidate-mapper";

/**
 * SPM-259, through `safety_officer_safety_check_candidates`, not the tables --
 * RLS is on with no policies. The function re-checks that the reader is a
 * Safety Officer (AC7) and answers CS050 if not, which comes back as the
 * domain's own error.
 */
export class SupabaseSafetyCheckCandidateRepository implements SafetyCheckCandidateRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async candidates(reader: UserAccountId): Promise<readonly SafetyCheckCandidate[]> {
    const key = toKey(reader);
    if (key === null) {
      // An id this store could never have issued is not a Safety Officer.
      throw new NotSafetyOfficerError();
    }

    // SPM-253: a hold that ran out is no longer a booking still in play, so mark it
    // Expired before the events are listed; left as a Tentative Hold it would stop an
    // event whose other bookings are all Confirmed from reaching the Safety Officer.
    await expireLapsedHolds(this.client);
    const { data, error } = await this.client.rpc("safety_officer_safety_check_candidates", {
      p_user_account_id: key,
    });

    if (error) {
      throw (
        toSafetyCheckCandidateError(error) ??
        new Error(`Failed to read the events awaiting a safety check: ${error.message}`, { cause: error })
      );
    }

    return ((data ?? []) as unknown as SafetyCheckCandidateRow[]).map(toSafetyCheckCandidate);
  }
}
