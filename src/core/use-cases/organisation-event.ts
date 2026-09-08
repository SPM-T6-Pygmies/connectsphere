import type { OrganiserEvent } from "../domain/organiser-event";
import type { OrganisationEvent } from "../ports/inbound/organisation-event";

/** Domain object to result DTO -- see `available-event.ts` for the sibling on the Attendee side. */
export function toOrganisationEvent(event: OrganiserEvent): OrganisationEvent {
  return {
    id: event.id,
    title: event.title,
    responsibleOrganiserId: event.responsibleOrganiserId,
    raisedAt: event.raisedAt.toISOString(),
  };
}
