import type { BookingStatus } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import type { EquipmentRequirement } from "./equipment-requirement";
import { EventNotAwaitingSafetyCheckError, SafetyCheckCommentsRequiredError } from "./errors";
import type { EventId } from "./event";
import type { UserAccountId } from "./user-account";

/** One of an event's venue bookings, on the event itself or on one of its sessions. */
export interface SafetyCheckBooking {
  readonly status: BookingStatus;
  readonly venueName: string;
}

export type SafetyCheckEquipmentLine = Pick<
  EquipmentRequirement,
  "state" | "quantityRequested" | "quantityReserved"
>;

/** What the store knows about an event, before any judgement about whether it awaits a safety check. */
export interface SafetyCheckCandidate {
  readonly event: {
    readonly id: EventId;
    readonly name: string;
    readonly status: CoordinatorEventStatus;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
    readonly expectedAttendance: number | null;
  };
  readonly bookings: readonly SafetyCheckBooking[];
  readonly equipmentLines: readonly SafetyCheckEquipmentLine[];
  /** Whether a Safety Officer has already recorded an outcome on the event (SPM-260). */
  readonly checked: boolean;
}

/** A booking still in play. A rejected, released or cancelled one says nothing about the venue any more. */
function isLive(booking: SafetyCheckBooking): boolean {
  return booking.status === "Requested" || booking.status === "Tentative Hold" || booking.status === "Confirmed";
}

/** Reserved, and for at least as many as the line asks for -- a partial reservation is not confirmed. */
function isReservedInFull(line: SafetyCheckEquipmentLine): boolean {
  return line.state === "Reserved" && line.quantityReserved >= line.quantityRequested;
}

/**
 * SPM-259: whether an event is waiting for the Safety Officer. It is when it
 * is still Planning (AC4), has at least one live venue booking and every live
 * one is Confirmed, and every equipment line is reserved in full (AC1, AC3).
 * No equipment lines means nothing to reserve, so the venue alone decides (AC2).
 * Once an outcome is recorded it leaves the list (SPM-260 AC6); sending it back
 * for a fresh check is SPM-261's.
 */
export function awaitsSafetyCheck(candidate: SafetyCheckCandidate): boolean {
  const live = candidate.bookings.filter(isLive);
  return (
    !candidate.checked &&
    candidate.event.status === "Planning" &&
    live.length > 0 &&
    live.every((booking) => booking.status === "Confirmed") &&
    candidate.equipmentLines.every(isReservedInFull)
  );
}

/** AC5: each venue the event is confirmed at, once, alphabetically. */
export function confirmedVenues(candidate: SafetyCheckCandidate): string[] {
  const names = candidate.bookings
    .filter((booking) => booking.status === "Confirmed")
    .map((booking) => booking.venueName);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * SPM-262: whether a change put the event on the Safety Officer's list -- it
 * did not await a check before and does now. Null is an event the store could
 * not find, which awaits nothing.
 */
export function entersSafetyCheck(
  before: SafetyCheckCandidate | null,
  after: SafetyCheckCandidate | null,
): boolean {
  return !(before !== null && awaitsSafetyCheck(before)) && after !== null && awaitsSafetyCheck(after);
}

/**
 * SPM-260 AC2: the two outcomes. Rejected is also the request for changes --
 * the comments say what must change -- and does not cancel the event.
 */
export type SafetyCheckOutcome = "Approved" | "Rejected";

/** An outcome ready to store. The store stamps when it was recorded (AC5). */
export interface RecordedSafetyCheck {
  readonly eventId: EventId;
  readonly outcome: SafetyCheckOutcome;
  /** Trimmed. Null when an approval leaves them blank. */
  readonly comments: string | null;
  readonly checkedBy: UserAccountId;
}

/**
 * SPM-260: a Safety Officer's outcome on an event. Only an event awaiting a
 * check takes one (AC6), and a rejection must say what has to change (AC3);
 * an approval's comments are optional (AC4).
 */
export function recordSafetyCheck(
  candidate: SafetyCheckCandidate,
  outcome: SafetyCheckOutcome,
  comments: string,
  checkedBy: UserAccountId,
): RecordedSafetyCheck {
  if (!awaitsSafetyCheck(candidate)) {
    throw new EventNotAwaitingSafetyCheckError();
  }

  const trimmed = comments.trim();
  if (outcome === "Rejected" && trimmed.length === 0) {
    throw new SafetyCheckCommentsRequiredError();
  }

  return {
    eventId: candidate.event.id,
    outcome,
    comments: trimmed.length === 0 ? null : trimmed,
    checkedBy,
  };
}
