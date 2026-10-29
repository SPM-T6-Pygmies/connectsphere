import type { CoordinatorEvent } from "./coordinator-event";
import { isReservedInFull, type EquipmentRequirement } from "./equipment-requirement";
import type { EventId } from "./event";
import {
  BookingFlaggedError,
  EssentialEquipmentNotReservedError,
  EventNotConfirmableError,
  EventNotReadyForConfirmationError,
  SafetyCheckNotApprovedError,
} from "./errors";
import { safetyCheckBlocker, type LatestSafetyCheck } from "./safety-check";

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
  /** SPM-318: each equipment line marked essential (SPM-109), and whether it is reserved in full. */
  readonly essentialEquipment: readonly EquipmentLineReadiness[];
  /** SPM-312: the event's venue bookings with an open review flag. */
  readonly flaggedBookings: readonly FlaggedBookingFacts[];
}

export interface EquipmentLineReadiness {
  readonly equipmentType: string;
  readonly reservedInFull: boolean;
}

/** SPM-318: what the store knows about one essential equipment line. */
export interface EssentialEquipmentFacts
  extends Pick<EquipmentRequirement, "state" | "quantityRequested" | "quantityReserved"> {
  readonly equipmentType: string;
}

/** SPM-312: one venue booking of the event with an open review flag (SPM-313, SPM-105). */
export interface FlaggedBookingFacts {
  readonly bookingId: string;
  readonly venueLocation: string;
  /** The day and hours it is booked for, e.g. `2026-11-16 13:00 to 18:00`. */
  readonly bookedFor: string;
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
  /** SPM-318: the event's equipment lines marked essential. A line not marked never enters, as above. */
  readonly essentialEquipment: readonly EssentialEquipmentFacts[];
  /**
   * SPM-312: each booking with an open flag, once however many reasons it has. A booking
   * that no longer holds its slot -- cancelled, released, a lapsed hold -- never enters.
   */
  readonly flaggedBookings: readonly FlaggedBookingFacts[];
}

/**
 * The arrangements SPM-50 can judge automatically. Technical support and
 * other have no completeness signal yet, so they neither block nor pass
 * confirmation. Equipment is judged per line instead, by `essentialEquipment`
 * (SPM-109, SPM-318), so the `equipment` type is not evaluated either.
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
    essentialEquipment: facts.essentialEquipment.map((line) => ({
      equipmentType: line.equipmentType,
      reservedInFull: isReservedInFull(line),
    })),
    flaggedBookings: facts.flaggedBookings,
  };
}

/** One essential equipment line as confirmed (SPM-66). */
export interface ConfirmedEquipmentLine {
  readonly equipmentType: string;
  readonly quantityReserved: number;
}

/**
 * What a confirmed event's Organiser is told was arranged (SPM-66). Only
 * essential arrangements enter: one not marked essential is Not applicable to
 * this event and is left out.
 */
export interface ConfirmedArrangements {
  /** Null when the venue is not essential to this event. */
  readonly venueLocation: string | null;
  readonly equipment: readonly ConfirmedEquipmentLine[];
}

/** SPM-66: the essential arrangements a just-confirmed event's Organiser is told about. */
export function confirmedArrangements(facts: ReadinessFacts): ConfirmedArrangements {
  return {
    venueLocation: facts.essentialTypes.includes("venue") ? facts.confirmedVenueLocation : null,
    equipment: facts.essentialEquipment.map(({ equipmentType, quantityReserved }) => ({
      equipmentType,
      quantityReserved,
    })),
  };
}

/** The essential arrangements still not complete -- what AC1 names when confirmation is refused. */
export function blockingArrangements(readiness: EventReadiness): readonly ArrangementType[] {
  return readiness.essentialArrangements
    .filter((arrangement) => !arrangement.complete)
    .map((arrangement) => arrangement.type);
}

/** SPM-318 AC1: the essential equipment lines not reserved in full, by type. A non-essential line never appears (AC2). */
export function blockingEquipment(readiness: EventReadiness): readonly string[] {
  return readiness.essentialEquipment.filter((line) => !line.reservedInFull).map((line) => line.equipmentType);
}

/** SPM-312: a flagged booking as the coordinator reads it, e.g. `Main Hall (2026-11-16 13:00 to 18:00)`. */
export function flaggedBookingName(booking: FlaggedBookingFacts): string {
  return `${booking.venueLocation} (${booking.bookedFor})`;
}

/**
 * SPM-312 AC1: every flagged booking blocks, by name. A flag stops blocking once it is
 * cleared (SPM-310) or its booking stops holding the slot (AC2).
 */
export function blockingFlags(readiness: EventReadiness): readonly string[] {
  return readiness.flaggedBookings.map(flaggedBookingName);
}

/**
 * Where an event stands on confirmation, and why -- so a screen can say why
 * it cannot be confirmed instead of deciding that from the status itself.
 */
export type ConfirmationState =
  | "ready"
  /**
   * Planning, with an essential arrangement incomplete, an essential equipment
   * line not reserved in full (SPM-318), a venue booking flagged (SPM-312) and/or the
   * safety check not Approved (SPM-264).
   */
  | "blocked"
  /** Confirmed or Completed: there is nothing left to confirm. */
  | "already-confirmed"
  /** Blocked or Cancelled: only a Planning event can be confirmed. */
  | "not-in-planning";

/** `latestSafetyCheck` is the event's newest check, or null when it has none (SPM-264). */
export function confirmationState(
  event: CoordinatorEvent,
  readiness: EventReadiness,
  latestSafetyCheck: LatestSafetyCheck | null,
): ConfirmationState {
  if (event.status === "Confirmed" || event.status === "Completed") {
    return "already-confirmed";
  }
  if (event.status !== "Planning") {
    return "not-in-planning";
  }
  return blockingArrangements(readiness).length > 0 ||
    blockingEquipment(readiness).length > 0 ||
    blockingFlags(readiness).length > 0 ||
    safetyCheckBlocker(latestSafetyCheck) !== null
    ? "blocked"
    : "ready";
}

/**
 * Whether the event may be confirmed right now: `Planning`, nothing essential
 * incomplete, every essential equipment line reserved in full, no venue booking
 * flagged, and its latest safety check Approved.
 */
export function canConfirm(
  event: CoordinatorEvent,
  readiness: EventReadiness,
  latestSafetyCheck: LatestSafetyCheck | null,
): boolean {
  return confirmationState(event, readiness, latestSafetyCheck) === "ready";
}

/**
 * SPM-50: confirms the event once every essential arrangement is complete.
 * SPM-318: and once every essential equipment line is reserved in full.
 * SPM-312: and once no venue booking is flagged for re-checking.
 * SPM-264: and once its latest safety check is Approved.
 *
 * The invariant itself, not just a use-case-level check -- callers cannot
 * reach `Confirmed` any other way than through this function agreeing to it.
 * `coordinator_confirm_event` restates the equipment, flag and safety rules
 * under its row lock.
 */
export function confirmEvent(
  event: CoordinatorEvent,
  readiness: EventReadiness,
  latestSafetyCheck: LatestSafetyCheck | null,
): CoordinatorEvent {
  if (event.status !== "Planning") {
    throw new EventNotConfirmableError(event.status);
  }

  const blocking = blockingArrangements(readiness);
  if (blocking.length > 0) {
    throw new EventNotReadyForConfirmationError(blocking);
  }

  const equipment = blockingEquipment(readiness);
  if (equipment.length > 0) {
    throw new EssentialEquipmentNotReservedError(equipment);
  }

  const flagged = blockingFlags(readiness);
  if (flagged.length > 0) {
    throw new BookingFlaggedError(flagged);
  }

  if (safetyCheckBlocker(latestSafetyCheck) !== null) {
    throw new SafetyCheckNotApprovedError();
  }

  return { ...event, status: "Confirmed" };
}
