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
  /** A short, plain-English explanation of what's actually true -- the booked venue, the agenda text, the registration window. */
  readonly detail: string;
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

/**
 * What the store knows about an event's arrangements, before any judgement
 * about whether they are complete -- that judgement is `assessReadiness`'s.
 */
export interface ReadinessFacts {
  readonly eventId: EventId;
  /** Every arrangement type marked essential for this event. */
  readonly essentialTypes: readonly ArrangementType[];
  /** Where the event's earliest Confirmed booking is, on the event or any of its sessions; null when there is none. */
  readonly confirmedVenueLocation: string | null;
  readonly programmeAgenda: string | null;
  readonly registrationEnabled: boolean;
  /** ISO calendar dates, `YYYY-MM-DD`. */
  readonly registrationOpenDate: string | null;
  readonly registrationCloseDate: string | null;
}

/**
 * The arrangements SPM-50 can judge automatically. Equipment, technical
 * support and other have no completeness signal yet (SPM-144 decides
 * essentiality at all; equipment's own completeness is SPM-109's), so they
 * neither block nor pass confirmation.
 */
const EVALUATED: readonly ArrangementType[] = ["venue", "programme", "registration"];

/** How much of the agenda the detail quotes. */
const AGENDA_PREVIEW_LENGTH = 80;

function assessArrangement(type: ArrangementType, facts: ReadinessFacts): ArrangementReadiness {
  switch (type) {
    case "venue":
      // Any one Confirmed booking counts, not one per session: multi-session
      // aggregation is unspecified, and this is the rule that does not block
      // confirmation on an unrelated session's booking.
      return facts.confirmedVenueLocation === null
        ? { type, complete: false, detail: "No confirmed venue booking yet." }
        : { type, complete: true, detail: `Confirmed at ${facts.confirmedVenueLocation}.` };
    case "programme": {
      const agenda = facts.programmeAgenda?.trim() ?? "";
      if (agenda === "") {
        return { type, complete: false, detail: "No agenda has been written yet." };
      }
      const preview =
        agenda.length > AGENDA_PREVIEW_LENGTH ? `${agenda.slice(0, AGENDA_PREVIEW_LENGTH)}…` : agenda;
      return { type, complete: true, detail: preview };
    }
    case "registration":
      if (!facts.registrationEnabled) {
        return { type, complete: false, detail: "Registration is not enabled for this event." };
      }
      if (facts.registrationOpenDate === null || facts.registrationCloseDate === null) {
        return {
          type,
          complete: false,
          detail: "Registration is enabled, but the open/close dates are not set yet.",
        };
      }
      return {
        type,
        complete: true,
        detail: `Open ${facts.registrationOpenDate} to ${facts.registrationCloseDate}.`,
      };
    default:
      throw new Error(`${type} is not an arrangement SPM-50 evaluates.`);
  }
}

/**
 * SPM-50: which of an event's essential arrangements are complete, and why.
 *
 * `coordinator_confirm_event` restates these rules in SQL as the last check
 * under its row lock (§8.6) -- a change here must be made there too.
 */
export function assessReadiness(facts: ReadinessFacts): EventReadiness {
  return {
    eventId: facts.eventId,
    essentialArrangements: EVALUATED.filter((type) => facts.essentialTypes.includes(type)).map(
      (type) => assessArrangement(type, facts),
    ),
  };
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
