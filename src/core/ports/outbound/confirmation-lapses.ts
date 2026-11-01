import type { EventId } from "../../domain/event";
import type { LapseCause, LapsedArrangement } from "../../domain/event-readiness";
import type { UserAccountId } from "../../domain/user-account";

/** SPM-111: an event that went back from Confirmed to Planning, with who to tell. */
export interface EventConfirmationLapse {
  readonly eventId: EventId;
  readonly eventName: string;
  /** The request the Organiser raised, where they view the event; null if it has since been deleted. */
  readonly eventRequestId: string | null;
  readonly owningOrganiserUserAccountId: UserAccountId;
  readonly lapsed: readonly LapsedArrangement[];
}

/**
 * Driven port: the confirmation lapses a change caused (SPM-111). The store lapses an
 * event inside the transaction of whatever caused it -- `lapse_event_confirmation`,
 * the single entry point every cause calls -- and records the lapse against that
 * cause, so the use case reads it back afterwards, as it does the bookings a block
 * flagged.
 */
export interface ConfirmationLapses {
  /**
   * The events `sourceRef` (a change request, a block, a venue edit) took out of
   * Confirmed, oldest first. Empty unless the reader is the event's coordinator or
   * Venue Staff (#91).
   */
  causedBy(reader: UserAccountId, cause: LapseCause, sourceRef: string): Promise<readonly EventConfirmationLapse[]>;
}
