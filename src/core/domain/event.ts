import type { Brand } from "./brand";
import { InvalidEventIdError } from "./errors";

export type EventId = Brand<string, "EventId">;

/**
 * Mirrors the team's `event_status_chk`, one member per allowed value.
 *
 * Not a superset and not a guess: a status this union carries but the schema
 * forbids is a case nothing can ever reach, and one the schema allows but this
 * union omits crashes the mapper on real data. Widen both together.
 */
export type EventStatus =
  | "planning"
  | "blocked"
  | "confirmed"
  | "completed"
  | "cancelled";

/**
 * An event as an Attendee is allowed to see it.
 *
 * Deliberately not the whole event record. Internal planning information --
 * operational notes, the decision record, coordinator assignments -- must not
 * reach an Attendee (brief s8b), so it never enters this type in the first
 * place rather than being filtered out at the edge.
 */
export interface Event {
  readonly id: EventId;
  readonly name: string;
  readonly description: string | null;
  readonly status: EventStatus;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** The location of the event's confirmed booking, if it has one. */
  readonly venueName: string | null;
  /** `null` means no ceiling has been set, which the business reads as unlimited. */
  readonly capacity: number | null;
  readonly registrationEnabled: boolean;
  readonly registrationOpensAt: Date | null;
  readonly registrationClosesAt: Date | null;
}

export function eventId(raw: string): EventId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidEventIdError(raw);
  }
  return trimmed as EventId;
}

/**
 * The single answer to "may an Attendee register for this event?".
 *
 * Three conditions, all from the customer: the event is confirmed (brief s5
 * step 11), registration is enabled for it ("where enabled", brief s4), and we
 * are inside the registration period the Event Coordinator set (#30).
 *
 * The list page, the detail page and the write path all ask this same
 * question. One rule with three callers is exactly what a domain predicate is
 * for -- putting it in a SQL `where` would leave the other two callers to
 * reimplement it.
 *
 * An unset window means the coordinator has not opened registration, so it is
 * not open. Both bounds are inclusive.
 */
export function isOpenForRegistration(event: Event, now: Date): boolean {
  if (event.status !== "confirmed" || !event.registrationEnabled) {
    return false;
  }

  const { registrationOpensAt, registrationClosesAt } = event;
  if (registrationOpensAt === null || registrationClosesAt === null) {
    return false;
  }

  return now >= registrationOpensAt && now <= registrationClosesAt;
}

/**
 * Whether the event has run out of places.
 *
 * `placesTaken` is a fact fetched through a port; turning it into a verdict is
 * a business decision, so the verdict is made here. A port that answered
 * `isFull()` would have moved the rule outside the hexagon.
 *
 * Release 1 has no waiting list, so a full event simply refuses.
 */
export function isFull(event: Event, placesTaken: number): boolean {
  return event.capacity !== null && placesTaken >= event.capacity;
}

/** Soonest first. Sorting is a pure function, not a reason to add a port. */
export function compareByStart(a: Event, b: Event): number {
  return a.startsAt.getTime() - b.startsAt.getTime();
}
