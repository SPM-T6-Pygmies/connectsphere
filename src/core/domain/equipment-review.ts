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
 * on any day, the units out are what active events on that day and the next
 * have reserved.
 */
function unitsOutOn(day: number, holds: readonly EquipmentHold[]): number {
  return holds
    .filter(
      (hold) =>
        isActiveEvent(hold.eventStatus) &&
        hold.eventDate !== null &&
        (dayNumber(hold.eventDate) === day || dayNumber(hold.eventDate) === day + 1),
    )
    .reduce((total, hold) => total + hold.quantityReserved, 0);
}

/**
 * AC4: how many units of a type are free for an event -- the number owned,
 * less those out of service (SPM-17 AC4), less what other events have out on
 * whichever of the event's two days, the day before it and its date, has more
 * out. Null when the event has no date yet, since there is nothing to compare
 * against.
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
  const day = dayNumber(eventDate);
  return owned - outOfService - Math.max(unitsOutOn(day - 1, otherHolds), unitsOutOn(day, otherHolds));
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

/** SPM-274 AC7: an event whose reserved units are out on a short day. */
export interface ShortDayEvent {
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly eventDate: string;
  readonly quantityReserved: number;
}

/**
 * SPM-274 AC7: one day, or a run of back-to-back days, on which more units
 * of a type are reserved than are in service -- with the same events out on
 * each day of the run.
 */
export interface ShortDays {
  /** ISO calendar dates, `YYYY-MM-DD`; the same for a single day. */
  readonly from: string;
  readonly to: string;
  /** What the events out on those days have reserved between them. */
  readonly reserved: number;
  readonly events: readonly ShortDayEvent[];
}

function isoDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/**
 * SPM-274 AC7: the days, from today on, on which more units of a type are out
 * than are in service. An event's units are out on the day before it, when
 * they are collected, and on its date, when they come back (#5, #113), so a
 * day counts what active events on that day and the next have reserved.
 * Back-to-back days with the same events out are merged into one run.
 * Soonest first.
 */
export function daysShortOfService(
  inService: number,
  reservations: readonly EventReservation[],
  today: string,
): ShortDays[] {
  const active = reservations.filter(
    (reservation): reservation is EventReservation & { readonly eventDate: string } =>
      isActiveEvent(reservation.eventStatus) && reservation.eventDate !== null,
  );
  const first = dayNumber(today);
  const days = [...new Set(active.flatMap(({ eventDate }) => [dayNumber(eventDate) - 1, dayNumber(eventDate)]))]
    .filter((day) => day >= first)
    .sort((a, b) => a - b);

  const runs: (ShortDays & { readonly last: number; readonly key: string })[] = [];
  for (const day of days) {
    const out = active
      .filter(({ eventDate }) => dayNumber(eventDate) === day || dayNumber(eventDate) === day + 1)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.eventName.localeCompare(b.eventName));
    const reserved = out.reduce((total, { quantityReserved }) => total + quantityReserved, 0);
    if (reserved <= inService) {
      continue;
    }
    const events = out.map(({ eventId, eventName, eventDate, quantityReserved }) => ({
      eventId,
      eventName,
      eventDate,
      quantityReserved,
    }));
    const key = events.map((event) => `${event.eventId}:${event.quantityReserved}`).join(",");
    const previous = runs.at(-1);
    if (previous !== undefined && previous.last === day - 1 && previous.key === key) {
      runs[runs.length - 1] = { ...previous, to: isoDate(day), last: day };
    } else {
      runs.push({ from: isoDate(day), to: isoDate(day), reserved, events, last: day, key });
    }
  }
  return runs.map(({ from, to, reserved, events }) => ({ from, to, reserved, events }));
}
