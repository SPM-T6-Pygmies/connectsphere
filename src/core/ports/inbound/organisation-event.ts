/**
 * An `OrganiserEvent`, translated to plain data for a driving adapter.
 *
 * Mirrors `AvailableEvent`'s role for the Attendee side: the core hands out
 * an instant as an ISO-8601 string and keeps no opinion about branded types
 * or display.
 */
export interface OrganisationEvent {
  readonly id: string;
  readonly title: string;
  readonly responsibleOrganiserId: string;
  readonly raisedAt: string;
}
