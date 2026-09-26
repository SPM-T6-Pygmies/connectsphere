import type { Connection } from "../../domain/connection";

/**
 * What an Event Coordinator is told when an event request is assigned to them
 * (SPM-57). Plain data, so each adapter decides its own wording.
 *
 * `clientOrganisationName` is `null` only if the organisation could not be
 * read back; the assignment has already been saved by then, so it is not worth
 * failing over.
 */
export interface EventCoordinatorAssignedNotice {
  readonly recipientUserAccountId: string;
  readonly eventRequestId: string;
  readonly eventName: string;
  readonly clientOrganisationName: string | null;
  readonly preferredDate: string | null;
  readonly preferredStartTime: string | null;
  readonly preferredEndTime: string | null;
}

/**
 * Driven port: telling someone something happened.
 *
 * The core does not know whether this becomes an email, a push notification, a
 * row in an outbox table or a no-op in development. Swapping any of those in
 * is a change to one file in `src/adapters/outbound`.
 */
export interface Notifier {
  connectionRequested(connection: Connection): Promise<void>;
  eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void>;
}
