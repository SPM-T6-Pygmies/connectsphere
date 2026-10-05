import type { BookingSlot } from "../../domain/booking";
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
  readonly preferredSlots: readonly BookingSlot[];
}

/**
 * What an Event Organiser is told when a coordinator is assigned to their
 * event request, or it is reassigned to another (SPM-58).
 *
 * `coordinatorName` is `null` only if the name could not be read back, for the
 * same reason as `clientOrganisationName` above.
 */
export interface OrganiserCoordinatorAssignedNotice {
  readonly recipientUserAccountId: string;
  readonly eventRequestId: string;
  readonly eventName: string;
  readonly coordinatorName: string | null;
}

/**
 * What an Event Organiser is told when the assigned coordinator returns their
 * request with a clarification question (SPM-59). `message` is the question as
 * stored, so the notification states what was asked.
 */
export interface ClarificationRequestedNotice {
  readonly recipientUserAccountId: string;
  readonly eventRequestId: string;
  readonly eventName: string;
  readonly message: string;
}

/**
 * What an Event Organiser is told when the assigned coordinator approves or
 * rejects their request (SPM-60). `decisionRecord` is the coordinator's reason
 * for a rejection, or their optional note on an approval.
 *
 * A return is not a decision here: it is a clarification request, notified as
 * `ClarificationRequestedNotice`.
 */
export interface EventRequestDecidedNotice {
  readonly recipientUserAccountId: string;
  readonly eventRequestId: string;
  readonly eventName: string;
  readonly decision: "approved" | "rejected";
  readonly decisionRecord: string | null;
}

/**
 * What a Safety Officer is told when an event joins their Awaiting check list
 * (SPM-262). Every Safety Officer gets their own copy.
 */
export interface SafetyCheckReadyNotice {
  readonly recipientUserAccountId: string;
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
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
  organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void>;
  clarificationRequested(notice: ClarificationRequestedNotice): Promise<void>;
  eventRequestDecided(notice: EventRequestDecidedNotice): Promise<void>;
  safetyCheckReady(notice: SafetyCheckReadyNotice): Promise<void>;
}
