import { slotStartsAt, type SlotOnDate } from "../domain/booking";
import type { Event } from "../domain/event";

/**
 * What the attendee-facing use cases return about an event.
 *
 * Plain, serialisable data: string ids and ISO-8601 timestamps rather than
 * branded types and `Date`s. A driving adapter can hand this straight to a
 * React Server Component, a Route Handler or a future tRPC procedure without
 * translation, and -- because instants carry no timezone opinion -- rendering
 * in Singapore time stays a decision for the edge, where it belongs.
 */
export interface AvailableEvent {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** When the first slot starts -- what the event is listed and grouped under. */
  readonly startsAt: string;
  /** Every slot the event runs in, in date then day order. */
  readonly slots: readonly SlotOnDate[];
  readonly venueName: string | null;
  readonly registrationClosesAt: string | null;
}

/**
 * Domain object to result DTO.
 *
 * The core hands out instants as ISO-8601 strings and keeps no opinion about
 * how they are displayed. Singapore is the only timezone this system serves
 * (#36), but that is a rendering fact, so it lives at the edge.
 */
export function toAvailableEvent(event: Event): AvailableEvent {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startsAt: slotStartsAt(event.slots[0]).toISOString(),
    slots: event.slots,
    venueName: event.venueName,
    registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
  };
}
