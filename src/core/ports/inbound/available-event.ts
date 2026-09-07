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
  readonly startsAt: string;
  readonly endsAt: string;
  readonly venueName: string | null;
  readonly registrationClosesAt: string | null;
}
