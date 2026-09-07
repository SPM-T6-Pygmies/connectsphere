import type { Brand } from "./brand";
import { InvalidEventIdError } from "./errors";
import type { MemberId } from "./member";
import type { ClientOrganisationId } from "./organisation";

export type EventId = Brand<string, "EventId">;

export interface Event {
  readonly id: EventId;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly responsibleOrganiserId: MemberId;
  readonly title: string;
  readonly raisedAt: Date;
}

export function eventId(raw: string): EventId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidEventIdError(raw);
  }
  return trimmed as EventId;
}

/**
 * The one place an `Event` can come into existence.
 *
 * Requiring a `ClientOrganisationId` and a `MemberId` here -- rather than
 * leaving them as optional fields a caller might forget -- is what makes "an
 * event with no organisation" or "an event with no responsible Organiser"
 * unrepresentable. Every later rule about who can view or edit an event
 * depends on both being present.
 */
export function raiseEvent(params: {
  id: EventId;
  clientOrganisationId: ClientOrganisationId;
  responsibleOrganiserId: MemberId;
  title: string;
  raisedAt: Date;
}): Event {
  return { ...params };
}
