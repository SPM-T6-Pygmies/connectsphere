import type { CoordinatorEvent } from "./coordinator-event";
import type { EventId } from "./event";
import { EventNotConfirmableError, EventNotReadyForConfirmationError } from "./errors";

/** Mirrors `event_essential_arrangement_type_chk` (`supabase/schema.sql`), one member per allowed value. */
export type ArrangementType =
  | "venue"
  | "equipment"
  | "technical_support"
  | "programme"
  | "registration"
  | "other";

export interface ArrangementReadiness {
  readonly type: ArrangementType;
  readonly complete: boolean;
}

/**
 * An event's essential arrangements and whether each is complete (SPM-50).
 *
 * Only essential rows enter this type -- an arrangement `event_essential_arrangement`
 * does not mark essential for this event never appears here, the same
 * "excluded data never enters the type" convention `Event` already uses for
 * what an Attendee may not see.
 */
export interface EventReadiness {
  readonly eventId: EventId;
  readonly essentialArrangements: readonly ArrangementReadiness[];
}

/** The essential arrangements still not complete -- what AC1 names when confirmation is refused. */
export function blockingArrangements(readiness: EventReadiness): readonly ArrangementType[] {
  return readiness.essentialArrangements
    .filter((arrangement) => !arrangement.complete)
    .map((arrangement) => arrangement.type);
}

/** Whether the event may be confirmed right now: `Planning`, with nothing essential left incomplete. */
export function canConfirm(event: CoordinatorEvent, readiness: EventReadiness): boolean {
  return event.status === "Planning" && blockingArrangements(readiness).length === 0;
}

/**
 * SPM-50: confirms the event once every essential arrangement is complete.
 *
 * The invariant itself, not just a use-case-level check -- callers cannot
 * reach `Confirmed` any other way than through this function agreeing to it.
 */
export function confirmEvent(event: CoordinatorEvent, readiness: EventReadiness): CoordinatorEvent {
  if (event.status !== "Planning") {
    throw new EventNotConfirmableError(event.status);
  }

  const blocking = blockingArrangements(readiness);
  if (blocking.length > 0) {
    throw new EventNotReadyForConfirmationError(blocking);
  }

  return { ...event, status: "Confirmed" };
}
