import type { CoordinatorEvent } from "../../domain/coordinator-event";
import type { LeadEvent } from "../../domain/coordinator-workload";
import type { EventId } from "../../domain/event";
import type { TimeRangeOnDate } from "../../domain/event-times";
import type { UserAccountId } from "../../domain/user-account";

/** One event as the Lead opens it: with when it runs (SPM-326 AC1). */
export interface LeadEventDetails extends LeadEvent {
  /** Its start and end times, in date then start order. Empty until it has any. */
  readonly times: readonly TimeRangeOnDate[];
}

/**
 * Driven port: events as the Event Coordinator Lead oversees them -- all of
 * them (SPM-256) -- and reassigns them (SPM-257). Each call takes the Lead so
 * a store can re-check they hold the role at the moment it acts; it throws
 * `NotCoordinatorLeadError` if not.
 */
export interface LeadEventRepository {
  /** Every event, soonest first and undated last. */
  listAll(reader: UserAccountId): Promise<readonly CoordinatorEvent[]>;

  /** One event, or null if there is none with that id. */
  findById(reader: UserAccountId, id: EventId): Promise<LeadEventDetails | null>;

  /**
   * Stores the event's new coordinator and records who changed it and when
   * (SPM-257 AC4), re-checking `reassignEventCoordinator`'s rule as it writes.
   */
  reassignCoordinator(event: LeadEvent, reassignedBy: UserAccountId): Promise<void>;
}
