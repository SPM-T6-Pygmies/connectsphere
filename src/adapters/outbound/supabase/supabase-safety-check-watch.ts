import type { BookingId } from "@/core/domain/booking";
import type { EventId } from "@/core/domain/event";
import type { SafetyCheckCandidate } from "@/core/domain/safety-check";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { SafetyCheckWatch } from "@/core/ports/outbound/safety-check-watch";

import type { SupabaseAdminClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import { toSafetyCheckCandidate, type SafetyCheckCandidateRow } from "./safety-check-candidate-mapper";

/**
 * SPM-262, through the service-role-only functions in
 * 20261009000000_safety_check_watch.sql: the change being watched is made by
 * Venue Staff or a coordinator, who may not read the safety list themselves.
 */
export class SupabaseSafetyCheckWatch implements SafetyCheckWatch {
  constructor(private readonly client: SupabaseAdminClient) {}

  candidateForEvent(id: EventId): Promise<SafetyCheckCandidate | null> {
    return this.candidate("safety_check_candidate", { p_event_id: toKey(id) });
  }

  candidateForBooking(id: BookingId): Promise<SafetyCheckCandidate | null> {
    return this.candidate("safety_check_candidate_for_booking", { p_booking_id: toKey(id) });
  }

  async safetyOfficers(): Promise<readonly UserAccountId[]> {
    const { data, error } = await this.client.rpc("safety_officer_ids");
    if (error) {
      throw new Error(`Failed to read the Safety Officers: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as { user_account_id: number }[]).map((row) =>
      userAccountId(String(row.user_account_id)),
    );
  }

  private async candidate(
    fn: "safety_check_candidate" | "safety_check_candidate_for_booking",
    args: Record<string, number | null>,
  ): Promise<SafetyCheckCandidate | null> {
    // An id this store could never have issued names no event.
    if (Object.values(args).includes(null)) {
      return null;
    }

    const { data, error } = await this.client.rpc(fn, args);
    if (error) {
      throw new Error(`Failed to read the event for its safety check: ${error.message}`, { cause: error });
    }

    const [row] = (data ?? []) as unknown as SafetyCheckCandidateRow[];
    return row === undefined ? null : toSafetyCheckCandidate(row);
  }
}
