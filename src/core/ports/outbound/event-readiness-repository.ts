import type { EventId } from "../../domain/event";
import type { EventReadiness } from "../../domain/event-readiness";

/**
 * Driven port: an event's essential-arrangement completeness (SPM-50).
 *
 * Kept separate from `CoordinatorEventRepository` -- a different,
 * independently-evolving read (spans `event_essential_arrangement`, `booking`
 * and `event`'s own free-text columns) that will plausibly change shape under
 * SPM-109 without the event repository changing at all.
 */
export interface EventReadinessRepository {
  /** An event with no essential-arrangement rows reads back with an empty list -- vacuously ready, not a gap (decision 1, SPM-144). */
  readinessFor(eventId: EventId): Promise<EventReadiness>;
}
