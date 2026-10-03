import type { EventId } from "../../domain/event";
import type { ReadinessFacts } from "../../domain/event-readiness";

/**
 * Driven port: what the store knows about an event's essential arrangements
 * (SPM-50) -- facts only. Whether they add up to "complete" is the domain's
 * `assessReadiness`, not the store's.
 *
 * Kept separate from `CoordinatorEventRepository` -- a different,
 * independently-evolving read (spans `event_essential_arrangement`, `booking`
 * and `event`'s own free-text columns) that will plausibly change shape under
 * SPM-109 without the event repository changing at all.
 */
export interface EventReadinessRepository {
  /** An event with no essential-arrangement rows reads back with no essential types -- vacuously ready, not a gap (decision 1, SPM-144). */
  factsFor(eventId: EventId): Promise<ReadinessFacts>;
}
