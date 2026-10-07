import type { CoordinatorEventStatus } from "./coordinator-event";
import { recheckReason, type EquipmentRequirement, type EquipmentReviewBaseline } from "./equipment-requirement";

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
 * AC3: what the line was when Technical Support reserved against it, while
 * that differs from what it is now -- null otherwise. A removal request on its
 * own changes nothing about the line, so it has nothing to show.
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
 * needing attention (AC1), active events whose lines are all reserved, and
 * Completed or Cancelled events.
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
 * less what other active events hold over overlapping days. Null when the
 * event has no date yet, since there is nothing to compare against.
 */
export function unitsAvailable(
  owned: number,
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
  return owned - held;
}
