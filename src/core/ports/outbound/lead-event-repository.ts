import type { CoordinatorEvent } from "../../domain/coordinator-event";
import type { LeadEvent } from "../../domain/coordinator-workload";
import type { EventId } from "../../domain/event";
import type { UserAccountId } from "../../domain/user-account";

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
  findById(reader: UserAccountId, id: EventId): Promise<LeadEvent | null>;

  /**
   * Stores the event's new coordinator and records who changed it and when
   * (SPM-257 AC4), re-checking `reassignEventCoordinator`'s rule as it writes.
   */
  reassignCoordinator(event: LeadEvent, reassignedBy: UserAccountId): Promise<void>;
}
