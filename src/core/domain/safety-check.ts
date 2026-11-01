import type { BookingStatus } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import { isReservedInFull, type EquipmentRequirement } from "./equipment-requirement";
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
  "state" | "quantityRequested" | "quantityReserved" | "essential"
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

/**
 * SPM-259: whether an event is waiting for the Safety Officer. It is when it
 * is still Planning (AC4), has at least one live venue booking and every live
 * one is Confirmed, and every essential equipment line is reserved in full
 * (AC1, AC3). No equipment lines means nothing to reserve, so the venue alone
 * decides (AC2). Once an outcome is recorded it leaves the list (SPM-260 AC6);
 * sending it back for a fresh check is SPM-261's.
 *
 * SPM-319: a non-essential line never holds the event back (AC1, AC2). A line
 * nobody has marked is non-essential, as SPM-109 stores it (AC3), so an event
 * with no essential line goes on the list on its venue alone.
 */
export function awaitsSafetyCheck(candidate: SafetyCheckCandidate): boolean {
  const live = candidate.bookings.filter(isLive);
  return (
    !candidate.checked &&
    candidate.event.status === "Planning" &&
    live.length > 0 &&
    live.every((booking) => booking.status === "Confirmed") &&
    candidate.equipmentLines.filter((line) => line.essential).every(isReservedInFull)
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

/**
 * SPM-261: the latest outcome on an event, and when it was sent back for a fresh check, if it was. For an
 * approval, that is when an accepted change of times, attendance or venue needs withdrew it.
 */
export interface LatestSafetyCheck {
  readonly outcome: SafetyCheckOutcome;
  /** ISO instant. Null until the coordinator resubmits. */
  readonly resubmittedAt: string | null;
}

/**
 * SPM-261 AC3: whether the coordinator can send an event back for a fresh
 * check. Only a Planning event whose latest outcome is a rejection not yet
 * resubmitted: an approval needs no second check, and one resubmission is
 * enough to put the event back in line (AC4).
 */
export function canResubmitForSafetyCheck(
  eventStatus: CoordinatorEventStatus,
  latest: LatestSafetyCheck | null,
): boolean {
  return (
    eventStatus === "Planning" && latest !== null && latest.outcome === "Rejected" && latest.resubmittedAt === null
  );
}

/**
 * SPM-264: why the safety check still stands in the way of confirming the
 * event -- no check yet (AC1), a rejection not yet resubmitted (AC2), or a
 * resubmission awaiting a fresh check (AC3).
 */
export type SafetyCheckBlocker = "no-check" | "rejected" | "awaiting-recheck";

/** SPM-264: what blocks confirmation on the safety side, or null once the latest check is Approved (AC4, AC5). */
export function safetyCheckBlocker(latest: LatestSafetyCheck | null): SafetyCheckBlocker | null {
  if (latest === null) {
    return "no-check";
  }
  if (latest.outcome === "Approved") {
    // A set `resubmittedAt` on an approval means a change withdrew it: it stands until the next outcome.
    return latest.resubmittedAt === null ? null : "awaiting-recheck";
  }
  return latest.resubmittedAt === null ? "rejected" : "awaiting-recheck";
}
