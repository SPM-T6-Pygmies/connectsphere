import type { Event, EventId } from "../../domain/event";

/**
 * Driven port: the event programme an Attendee is allowed to read.
 *
 * `listConfirmed` narrows on status alone. That is a visibility rule -- an
 * Attendee must not see events still being planned (brief s8b) -- and not the
 * registration rule, which the core applies to what comes back. Pushing
 * "is registration open?" into the store would make the database the only
 * enforcer of a rule the domain is supposed to own.
 */
export interface EventCatalogue {
  listConfirmed(): Promise<Event[]>;

  findEvent(id: EventId): Promise<Event | null>;
}
