import type { EventId } from "./event";
import type { MemberId } from "./member";
import type { ClientOrganisationId } from "./organisation";

/**
 * An event as its responsible Event Organiser, and colleagues in the same
 * client organisation, are allowed to see it -- the full record, as opposed
 * to the Attendee-facing projection in `event.ts`. Shares `EventId`: it is
 * the same underlying event, viewed from the other side of the hexagon.
 */
export interface OrganiserEvent {
  readonly id: EventId;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly responsibleOrganiserId: MemberId;
  readonly title: string;
  readonly raisedAt: Date;
}

/**
 * The one place an `OrganiserEvent` can come into existence.
 *
 * Requiring a `ClientOrganisationId` and a `MemberId` here -- rather than
 * leaving them as optional fields a caller might forget -- is what makes "an
 * event with no organisation" or "an event with no responsible Organiser"
 * unrepresentable. Every later rule about who can view or edit an event
 * depends on both being present.
 */
export function raiseOrganiserEvent(params: {
  id: EventId;
  clientOrganisationId: ClientOrganisationId;
  responsibleOrganiserId: MemberId;
  title: string;
  raisedAt: Date;
}): OrganiserEvent {
  return { ...params };
}
