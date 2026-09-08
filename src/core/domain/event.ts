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

/**
 * Whether this event still lets an Attendee release a place.
 *
 * SPM-84 settled the cut-off the brief left open ("where permitted", s4): there
 * is none before the event date, matching the absence of any general change
 * cut-off for events (#8). A completed event is the one bar, because its
 * attendance has become a historical record (#20) rather than a live roll.
 *
 * Deliberately not `isOpenForRegistration`. Registration closing is a window
 * the coordinator sets and may extend; withdrawal outlives it, so reusing that
 * predicate here would refuse every attendee whose event was about to happen --
 * exactly when they most need to withdraw.
 */
export function allowsWithdrawal(event: Event): boolean {
  return event.status !== "completed";
}

/** Soonest first. Sorting is a pure function, not a reason to add a port. */
export function compareByStart(a: Event, b: Event): number {
  return a.startsAt.getTime() - b.startsAt.getTime();
}
