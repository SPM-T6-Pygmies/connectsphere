import type { CoordinatorEventStatus } from "./coordinator-event";
import { recheckReason, type EquipmentRequirement, type EquipmentReviewBaseline } from "./equipment-requirement";
import {
  EquipmentAvailableToReserveError,
  EquipmentLineNotAwaitingDecisionError,
  EventDateRequiredForEquipmentError,
  NotEnoughEquipmentAvailableError,
  UnfulfilledCommentRequiredError,
  UnfulfilledCommentTooLongError,
} from "./errors";
import type { UserAccountId } from "./user-account";

/**
 * Why a line needs Technical Support's attention (SPM-273 AC1): nothing has
 * been reserved against it yet, the coordinator changed it after it was
 * reserved, or they asked for it to be removed.
 */
export type AttentionReason = "new" | "changed" | "removalRequested";

/** AC1: why this line needs Technical Support's attention, or null when it does not. */
export function attentionReason(line: EquipmentRequirement): AttentionReason | null {
  return line.state === "Requested" ? "new" : recheckReason(line);
}

/**
 * AC3: what the line was when Technical Support reserved against it -- or
 * marked it unfulfilled (SPM-274 AC4) -- while that differs from what it is
 * now; null otherwise. A removal request on its own changes nothing about the
 * line, so it has nothing to show.
 */
export function reservedAs(line: EquipmentRequirement): EquipmentReviewBaseline | null {
  const baseline = line.reviewBaseline;
  if (baseline === null) {
    return null;
  }
  const differs =
    baseline.quantityRequested !== line.quantityRequested ||
    baseline.technicalRequirements !== line.technicalRequirements;
  return differs ? baseline : null;
}

/** AC1: an event still running its course. A Completed or Cancelled one has nothing left to prepare. */
export function isActiveEvent(status: CoordinatorEventStatus): boolean {
  return status === "Planning" || status === "Blocked" || status === "Confirmed";
}

/**
 * The three lists of Technical Support's workspace: events with a line
 * needing attention (AC1), active events whose lines are all reserved or
 * marked unfulfilled (SPM-274), and Completed or Cancelled events.
 */
export type EquipmentQueue = "needsReview" | "reviewed" | "archive";

/** Which of Technical Support's lists an event belongs on, or null for an event with no equipment lines. */
export function equipmentQueueOf(
  status: CoordinatorEventStatus,
  lines: readonly EquipmentRequirement[],
): EquipmentQueue | null {
  if (lines.length === 0) {
    return null;
  }
  if (!isActiveEvent(status)) {
    return "archive";
  }
  return lines.some((line) => attentionReason(line) !== null) ? "needsReview" : "reviewed";
}

/** Units of one equipment type another event has reserved, and when that event runs. */
export interface EquipmentHold {
  readonly eventStatus: CoordinatorEventStatus;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly eventDate: string | null;
  readonly quantityReserved: number;
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Equipment for an event on day D is collected on D-1 and is available again
 * from Return Day + 1, the return day being the event's date (#5, #113). So
 * two events hold the same units over days they share exactly when they are at
 * most one day apart.
 */
export function holdsOverlap(eventDate: string, otherEventDate: string): boolean {
  return Math.abs(dayNumber(eventDate) - dayNumber(otherEventDate)) <= 1;
}

/**
 * AC4: how many units of a type are free for an event -- the number owned,
 * less those out of service (SPM-17 AC4), less what other active events hold
 * over overlapping days. Null when the event has no date yet, since there is
 * nothing to compare against.
 */
export function unitsAvailable(
  owned: number,
  outOfService: number,
  eventDate: string | null,
  otherHolds: readonly EquipmentHold[],
): number | null {
  if (eventDate === null) {
    return null;
  }
  const held = otherHolds
    .filter(
      (hold) => isActiveEvent(hold.eventStatus) && hold.eventDate !== null && holdsOverlap(eventDate, hold.eventDate),
    )
    .reduce((total, hold) => total + hold.quantityReserved, 0);
  return owned - outOfService - held;
}

/**
 * AC4: the figure a line shows -- how many more units of its type could be
 * reserved for it: what is free for the event (`unitsAvailable`), less what
 * the line already holds. The same as `unitsAvailable` for a line with
 * nothing reserved. Null when the event has no date yet.
 */
export function unitsAvailableForLine(
  line: EquipmentRequirement,
  owned: number,
  outOfService: number,
  eventDate: string | null,
  otherHolds: readonly EquipmentHold[],
): number | null {
  const available = unitsAvailable(owned, outOfService, eventDate, otherHolds);
  return available === null ? null : available - line.quantityReserved;
}

/** SPM-274: an event's date and status, as far as deciding on its lines needs. */
export interface EquipmentDecisionEvent {
  readonly status: CoordinatorEventStatus;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
}

/** SPM-274: one line, with what `unitsAvailable` needs to judge it. */
export interface EquipmentDecisionLine {
  readonly line: EquipmentRequirement;
  readonly owned: number;
  readonly outOfService: number;
  readonly otherHolds: readonly EquipmentHold[];
}

/** SPM-274 AC3. */
export const UNFULFILLED_COMMENT_MAX_LENGTH = 500;

/**
 * SPM-274: whether Technical Support can reserve this line or mark it
 * unfulfilled -- it needs their attention and nothing is held against it: a
 * New line (AC1), or one marked unfulfilled that the coordinator then changed
 * (AC4). A reserved line that changed is released or replaced instead (SPM-108).
 */
export function awaitsDecision(status: CoordinatorEventStatus, line: EquipmentRequirement): boolean {
  return (
    isActiveEvent(status) &&
    line.quantityReserved === 0 &&
    (line.state === "Requested" || (line.state === "Under review" && !line.removalRequested))
  );
}

/**
 * SPM-274 AC1: reserves the full quantity requested, recording who did. AC2:
 * not before the event has a date. AC3: all or nothing -- with too few units
 * free, nothing is reserved.
 */
export function reserveEquipmentLine(
  event: EquipmentDecisionEvent,
  target: EquipmentDecisionLine,
  by: UserAccountId,
): EquipmentRequirement {
  const { line } = target;
  const available = availableToDecide(event, target);
  if (available < line.quantityRequested) {
    throw new NotEnoughEquipmentAvailableError(available, line.quantityRequested);
  }
  return {
    ...line,
    quantityReserved: line.quantityRequested,
    state: "Reserved",
    reviewBaseline: null,
    decision: { by, comment: null },
  };
}

/**
 * SPM-274 AC3: with too few units free, the line is marked unfulfilled with a
 * comment saying why, and nothing is reserved. Not while enough are free --
 * then it is reserved instead.
 */
export function markEquipmentLineUnfulfilled(
  event: EquipmentDecisionEvent,
  target: EquipmentDecisionLine,
  by: UserAccountId,
  comment: string,
): EquipmentRequirement {
  const { line } = target;
  const available = availableToDecide(event, target);
  if (available >= line.quantityRequested) {
    throw new EquipmentAvailableToReserveError(available, line.quantityRequested);
  }
  return {
    ...line,
    state: "Unfulfilled",
    reviewBaseline: null,
    decision: { by, comment: validComment(comment) },
  };
}

function availableToDecide(event: EquipmentDecisionEvent, target: EquipmentDecisionLine): number {
  if (!awaitsDecision(event.status, target.line)) {
    throw new EquipmentLineNotAwaitingDecisionError();
  }
  const available = unitsAvailable(target.owned, target.outOfService, event.preferredDate, target.otherHolds);
  if (available === null) {
    throw new EventDateRequiredForEquipmentError();
  }
  return available;
}

function validComment(comment: string): string {
  const trimmed = comment.trim();
  if (trimmed === "") {
    throw new UnfulfilledCommentRequiredError();
  }
  if (trimmed.length > UNFULFILLED_COMMENT_MAX_LENGTH) {
    throw new UnfulfilledCommentTooLongError(UNFULFILLED_COMMENT_MAX_LENGTH);
  }
  return trimmed;
}

/** SPM-274 AC7: one event's reservation of an equipment type. */
export interface EventReservation extends EquipmentHold {
  readonly eventId: string;
  readonly eventName: string;
}

/** SPM-274 AC7: an upcoming event that, with the events over its days, holds more than is in service. */
export interface OverheldEvent {
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly eventDate: string;
  /** What it has reserved itself. */
  readonly reserved: number;
  /** What it and every active event over overlapping days have reserved together. */
  readonly held: number;
}

/**
 * SPM-274 AC7: after a type's stock changes, the upcoming events (dated today
 * or later) that now hold more than is in service -- those for which what
 * they and every other active event over overlapping days have reserved
 * comes to more than the units in service. Soonest first.
 */
export function eventsHoldingMoreThanInService(
  inService: number,
  reservations: readonly EventReservation[],
  today: string,
): OverheldEvent[] {
  const active = reservations.filter(
    (reservation): reservation is EventReservation & { readonly eventDate: string } =>
      isActiveEvent(reservation.eventStatus) && reservation.eventDate !== null,
  );
  return active
    .filter((reservation) => reservation.eventDate >= today)
    .map((reservation) => ({
      eventId: reservation.eventId,
      eventName: reservation.eventName,
      eventDate: reservation.eventDate,
      reserved: reservation.quantityReserved,
      held: active
        .filter((other) => holdsOverlap(reservation.eventDate, other.eventDate))
        .reduce((total, other) => total + other.quantityReserved, 0),
    }))
    .filter((event) => event.held > inService)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.eventName.localeCompare(b.eventName));
}
