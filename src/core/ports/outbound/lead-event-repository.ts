import type { CoordinatorEvent } from "../../domain/coordinator-event";
import type { UserAccountId } from "../../domain/user-account";

/** Driven port: events as the Event Coordinator Lead oversees them -- all of them (SPM-256). */
export interface LeadEventRepository {
  /**
   * Every event, soonest first and undated last. Takes the reader so a store
   * can re-check they are an Event Coordinator Lead at the moment it reads;
   * throws `NotCoordinatorLeadError` if not.
   */
  listAll(reader: UserAccountId): Promise<readonly CoordinatorEvent[]>;
}
