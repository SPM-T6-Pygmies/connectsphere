import type { Event } from "../domain/event";
import type { AvailableEvent } from "../ports/inbound/available-event";

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
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    venueName: event.venueName,
    registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
  };
}
