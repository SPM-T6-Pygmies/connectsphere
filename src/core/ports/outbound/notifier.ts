import type { BookingSlot } from "../../domain/booking";
import type { Connection } from "../../domain/connection";
import type { ConfirmedEquipmentLine } from "../../domain/event-readiness";
import type { TimeRangeOnDate } from "../../domain/event-times";
import type { SafetyCheckOutcome } from "../../domain/safety-check";

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
  /**
   * Set when an approved event is reassigned (SPM-257): the coordinator gets
   * the event, not the request, which stays with whoever reviewed it.
   */
  readonly eventId?: string;
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
 * What an event request's assigned Event Coordinator is told when its Event
 * Organiser posts on the clarification thread, as a reply or a new message
 * (SPM-164). `message` is the post as stored, so the notification quotes it.
 */
export interface OrganiserMessagePostedNotice {
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
  /** The venue of each Confirmed booking, alphabetically -- what the check is of. */
  readonly venues: readonly string[];
  /** How many equipment lines the event has, all reserved in full by now. */
  readonly equipmentLines: number;
}

/**
 * What an event's assigned Event Coordinator is told when a Safety Officer
 * records its safety check (SPM-263). `comments` are the Officer's, trimmed:
 * what must change for a rejection, an optional note for an approval.
 */
export interface SafetyCheckRecordedNotice {
  readonly recipientUserAccountId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly outcome: SafetyCheckOutcome;
  readonly comments: string | null;
}

/**
 * What a Venue Staff member is told when a coordinator asks for a venue
 * (SPM-61). Every Venue Staff member gets their own copy: staff are not
 * scoped to particular venues (#66).
 */
export interface VenueBookingRequestedNotice {
  readonly recipientUserAccountId: string;
  readonly bookingId: string;
  readonly eventName: string;
  readonly venueLocation: string;
  /** In date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
}

/**
 * What a Technical Support Staff member is told when a coordinator changes an
 * equipment line (SPM-64). Every member gets their own copy: staff are not
 * scoped to particular events (#66).
 */
export interface EquipmentNeedsAttentionNotice {
  readonly recipientUserAccountId: string;
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly equipmentType: string;
  /** What the coordinator did to the line (AC1). */
  readonly change: "added" | "edited" | "deleted" | "removalRequested" | "removalWithdrawn";
  /** What the line requests now -- for a deleted line, what it requested. */
  readonly quantityRequested: number;
  /** For an edit that changed the quantity, what it was just before; null otherwise. */
  readonly quantityWas: number | null;
  /**
   * Why the line needs their attention now, as the Needs review page marks it
   * (SPM-273 AC3); null when it needs nothing -- deleted, or back to what they
   * decided (AC2).
   */
  readonly attention: "new" | "changed" | "removalRequested" | null;
}

/** One line of an event Technical Support have finished deciding on (SPM-65 AC3). */
export interface EquipmentLineOutcome {
  readonly equipmentType: string;
  readonly quantityRequested: number;
  readonly outcome: "reserved" | "unfulfilled";
  readonly quantityReserved: number;
  /** Who reserved it or marked it unfulfilled; null for a line decided before that was recorded. */
  readonly decidedByName: string | null;
  /** Technical Support's reason for an unfulfilled line; null for a reserved one. */
  readonly comment: string | null;
}

/**
 * What an event's assigned Event Coordinator is told when Technical Support's
 * decision leaves nothing on the event needing their attention (SPM-65): one
 * notice, listing every line's outcome.
 */
export interface EquipmentDecidedNotice {
  readonly recipientUserAccountId: string;
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  /** Every equipment line on the event, by type. */
  readonly lines: readonly EquipmentLineOutcome[];
}

/**
 * What an event's assigned Event Coordinator is told when Venue Staff decide
 * one of its booking requests (SPM-62). An event can hold several bookings,
 * so the notice names the venue it concerns. A rejection carries the stored
 * reason and the venue suggested instead, if any -- an informal suggestion,
 * not a counter-offer (#45).
 */
export interface VenueBookingDecidedNotice {
  readonly recipientUserAccountId: string;
  readonly bookingId: string;
  readonly eventId: string;
  /** The approved request the coordinator books venues from; null if the event has none. */
  readonly eventRequestId: string | null;
  readonly eventName: string;
  readonly venueLocation: string;
  /** In date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
  /** Released: Venue Staff gave up a hold on the event's behalf (SPM-219). */
  readonly outcome: "Confirmed" | "Rejected" | "Released";
  /** Null unless rejected. */
  readonly reason: string | null;
  readonly suggestedAlternativeLocation: string | null;
}

/**
 * What an event's assigned Event Coordinator is told when a tentative hold on
 * one of its venues expires unconfirmed (SPM-254): the venue is no longer
 * held. Names the venue, the held times and when the hold lapsed (AC2).
 */
export interface HoldExpiredNotice {
  readonly recipientUserAccountId: string;
  readonly bookingId: string;
  readonly eventId: string;
  /** The approved request the coordinator books venues from; null if the event has none. */
  readonly eventRequestId: string | null;
  readonly eventName: string;
  readonly venueLocation: string;
  /** In date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
  /** ISO instant the hold lapsed. */
  readonly holdExpiresAt: string;
}

/**
 * What a Venue Staff member is told when a coordinator cancels a confirmed
 * booking (SPM-63), so nobody prepares the venue for an event that is not
 * happening. Every Venue Staff member gets their own copy: staff are not
 * scoped to particular venues (#66).
 */
export interface VenueBookingCancelledNotice {
  readonly recipientUserAccountId: string;
  readonly bookingId: string;
  /** Where the notice opens the venue's calendar (AC4). */
  readonly venueId: string;
  readonly venueLocation: string;
  readonly eventName: string;
  /** The times released, in date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
}

/**
 * What an Event Organiser is told when the assigned coordinator confirms their
 * event (SPM-66): the point ConnectSphere is committed (#80). Lists only the
 * essential arrangements -- one Not applicable to the event is left out.
 */
export interface EventConfirmedNotice {
  readonly recipientUserAccountId: string;
  readonly eventId: string;
  /** The request the Organiser raised, where they view the event; null if it has since been deleted. */
  readonly eventRequestId: string | null;
  readonly eventName: string;
  /** In date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
  /** Null when the venue is not essential to this event. */
  readonly venueLocation: string | null;
  /** The essential equipment lines, each reserved in full. */
  readonly equipment: readonly ConfirmedEquipmentLine[];
}

/**
 * What an Attendee is told once their registration is recorded (SPM-87): the
 * event, as the on-screen confirmation shows it, and the reference that is
 * their only way back to the registration.
 *
 * Addressed by email rather than user account: an Attendee has no account.
 * No link either -- where the registration page lives is the adapter's
 * business, not the core's.
 */
export interface RegistrationConfirmedNotice {
  readonly registrationId: string;
  readonly recipientEmail: string;
  readonly attendeeName: string;
  readonly eventName: string;
  /** ISO instant the event first starts, as `AvailableEvent` gives it. */
  readonly startsAt: string;
  readonly times: readonly TimeRangeOnDate[];
  readonly venueName: string | null;
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
  organiserMessagePosted(notice: OrganiserMessagePostedNotice): Promise<void>;
  eventRequestDecided(notice: EventRequestDecidedNotice): Promise<void>;
  safetyCheckReady(notice: SafetyCheckReadyNotice): Promise<void>;
  safetyCheckRecorded(notice: SafetyCheckRecordedNotice): Promise<void>;
  venueBookingRequested(notice: VenueBookingRequestedNotice): Promise<void>;
  equipmentNeedsAttention(notice: EquipmentNeedsAttentionNotice): Promise<void>;
  equipmentDecided(notice: EquipmentDecidedNotice): Promise<void>;
  venueBookingDecided(notice: VenueBookingDecidedNotice): Promise<void>;
  holdExpired(notice: HoldExpiredNotice): Promise<void>;
  venueBookingCancelled(notice: VenueBookingCancelledNotice): Promise<void>;
  eventConfirmed(notice: EventConfirmedNotice): Promise<void>;
  registrationConfirmed(notice: RegistrationConfirmedNotice): Promise<void>;
}
