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
