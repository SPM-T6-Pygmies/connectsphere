import { EventNotAwaitingSafetyCheckError, EventNotFoundError, NotSafetyOfficerError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { RecordedSafetyCheck } from "@/core/domain/safety-check";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  CoordinatorSafetyCheckHistory,
  SafetyCheckRepository,
  SafetyCheckReview,
} from "@/core/ports/outbound/safety-check-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import {
  toCoordinatorSafetyCheckHistory,
  toSafetyCheckError,
  toSafetyCheckReview,
  type CoordinatorSafetyCheckHistoryRow,
  type SafetyCheckReviewRow,
} from "./safety-check-mapper";

/**
 * SPM-260, through `safety_officer_safety_check_review` and
 * `safety_officer_record_safety_check`, not the tables -- `safety_check` has
 * RLS on with no policies. Both re-check that the caller is a Safety Officer,
 * and the record restates that the event is still unchecked under a lock on it.
 * SPM-261's coordinator reads and resubmission go through
 * `coordinator_event_safety_checks` and `coordinator_resubmit_safety_check`,
 * which answer only for the event's assigned coordinator.
 */
export class SupabaseSafetyCheckRepository implements SafetyCheckRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async review(reader: UserAccountId, event: EventId): Promise<SafetyCheckReview | null> {
    const readerKey = toKey(reader);
    if (readerKey === null) {
      // An id this store could never have issued is not a Safety Officer.
      throw new NotSafetyOfficerError();
    }
    const eventKey = toKey(event);
    if (eventKey === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("safety_officer_safety_check_review", {
      p_user_account_id: readerKey,
      p_event_id: eventKey,
    });
    if (error) {
      throw (
        toSafetyCheckError(error) ??
        new Error(`Failed to read the event's safety check: ${error.message}`, { cause: error })
      );
    }

    return data === null ? null : toSafetyCheckReview(data as unknown as SafetyCheckReviewRow);
  }

  async record(check: RecordedSafetyCheck): Promise<void> {
    const officerKey = toKey(check.checkedBy);
    if (officerKey === null) {
      throw new NotSafetyOfficerError();
    }
    const eventKey = toKey(check.eventId);
    if (eventKey === null) {
      throw new EventNotAwaitingSafetyCheckError();
    }

    const { error } = await this.client.rpc("safety_officer_record_safety_check", {
      p_user_account_id: officerKey,
      p_event_id: eventKey,
      p_outcome: check.outcome,
      // The function treats null and blank alike; it needs a text argument.
      p_comments: check.comments ?? "",
    });
    if (error) {
      throw (
        toSafetyCheckError(error) ??
        new Error(`Failed to record the safety check: ${error.message}`, { cause: error })
      );
    }
  }

  async history(coordinator: UserAccountId, event: EventId): Promise<CoordinatorSafetyCheckHistory | null> {
    const coordinatorKey = toKey(coordinator);
    const eventKey = toKey(event);
    if (coordinatorKey === null || eventKey === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("coordinator_event_safety_checks", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
    });
    if (error) {
      throw new Error(`Failed to read the event's safety checks: ${error.message}`, { cause: error });
    }

    return data === null ? null : toCoordinatorSafetyCheckHistory(data as unknown as CoordinatorSafetyCheckHistoryRow);
  }

  async resubmit(coordinator: UserAccountId, event: EventId): Promise<void> {
    const coordinatorKey = toKey(coordinator);
    const eventKey = toKey(event);
    if (coordinatorKey === null || eventKey === null) {
      throw new EventNotFoundError(event);
    }

    const { error } = await this.client.rpc("coordinator_resubmit_safety_check", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
    });
    if (error) {
      throw (
        toSafetyCheckError(error, event) ??
        new Error(`Failed to resubmit the event for a safety check: ${error.message}`, { cause: error })
      );
    }
  }
}
