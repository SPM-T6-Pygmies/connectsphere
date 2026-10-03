import type { CoordinatorEvent, CoordinatorEventStatus } from "./coordinator-event";
import type { EquipmentItemId } from "./equipment-item";
import {
  DuplicateEquipmentRequirementError,
  EquipmentRemovalAlreadyRequestedError,
  EquipmentRemovalNotRequestedError,
  EquipmentRequirementsLockedError,
  InvalidEquipmentQuantityError,
  TechnicalRequirementsTooLongError,
} from "./errors";

/** SPM-41 AC5. */
export const TECHNICAL_REQUIREMENTS_MAX_LENGTH = 500;

/**
 * One line of an event's equipment requirements (SPM-41): a catalogue item,
 * how many the event needs, and anything Technical Support Staff should know
 * about them.
 *
 * Mirrors `equipment_reservation_line`. The coordinator records the line,
 * Technical Support reserve against it, and a change after that puts the line
 * under review instead of going through a change request (#114).
 */
export interface EquipmentRequirement {
  readonly equipmentItemId: EquipmentItemId;
  readonly quantityRequested: number;
  readonly technicalRequirements: string | null;
  /** How many Technical Support have reserved against this line -- 0 until they do. */
  readonly quantityReserved: number;
  /**
   * Where the line stands with Technical Support: `Requested` until they
   * reserve, `Reserved` after, and `Under review` once a coordinator's change
   * (AC8) or removal request (AC11) means they must re-check it. `Requested`
   * exactly when `quantityReserved` is 0.
   */
  readonly state: EquipmentLineState;
  /** What Technical Support last had reserved against. Set exactly while the line is `Under review`. */
  readonly reviewBaseline: EquipmentReviewBaseline | null;
  /**
   * The coordinator removed a reserved line (AC11). It stays, with its
   * equipment held, until Technical Support release it (SPM-108) or the
   * coordinator undoes the removal (AC17).
   */
  readonly removalRequested: boolean;
}

export type EquipmentLineState = "Requested" | "Reserved" | "Under review";

/**
 * What Technical Support last had reserved against a line, kept while the line
 * is Under review: editing the line back to exactly this means there is nothing
 * left to re-check, so it returns to Reserved (AC19).
 */
export interface EquipmentReviewBaseline {
  readonly quantityRequested: number;
  readonly technicalRequirements: string | null;
}

/** What the coordinator enters for a line. The type is chosen once, when the line is added. */
export interface EquipmentRequirementDetails {
  readonly quantityRequested: number;
  readonly technicalRequirements: string | null;
}

export interface NewEquipmentRequirement extends EquipmentRequirementDetails {
  readonly equipmentItemId: EquipmentItemId;
}

export interface EquipmentRequirementEdit {
  readonly line: EquipmentRequirement;
  /** False for a save that changed nothing (AC9) -- nothing to persist, nothing to tell anyone. */
  readonly changed: boolean;
  /** This edit left a reserved line under review for Technical Support to re-check (AC8). */
  readonly underReview: boolean;
  /** This edit put a line under review back to what Technical Support had, so it is Reserved again (AC19). */
  readonly reviewCleared: boolean;
}

/**
 * An unreserved line simply goes (AC10). A reserved one stays, under review,
 * with its equipment held until Technical Support release it (AC11).
 */
export type EquipmentRequirementRemoval =
  | { readonly kind: "deleted" }
  | { readonly kind: "removalRequested"; readonly line: EquipmentRequirement };

/** AC13: requirements can change until the event is Completed or Cancelled. */
export function equipmentRequirementsEditable(status: CoordinatorEventStatus): boolean {
  return status === "Planning" || status === "Blocked" || status === "Confirmed";
}

/** Why a line under review is on Technical Support's "Needs re-check" list (AC15). */
export type RecheckReason = "changed" | "removalRequested";

/**
 * AC15: whether Technical Support should re-check this line, and why -- null for
 * a line that is not under review. A line stays under review after an undone
 * removal (AC17), so it reads as changed.
 */
export function recheckReason(line: EquipmentRequirement): RecheckReason | null {
  if (line.state !== "Under review") {
    return null;
  }
  return line.removalRequested ? "removalRequested" : "changed";
}

/** Whether Technical Support have reserved any equipment against this line yet. */
export function isReserved(line: EquipmentRequirement): boolean {
  return line.state !== "Requested";
}

/** AC1-5: the only way to add a line to an event. */
export function recordEquipmentRequirement(
  event: CoordinatorEvent,
  existing: readonly EquipmentRequirement[],
  requirement: NewEquipmentRequirement,
): EquipmentRequirement {
  assertEditable(event);
  const details = validDetails(requirement);

  if (existing.some((line) => line.equipmentItemId === requirement.equipmentItemId)) {
    throw new DuplicateEquipmentRequirementError();
  }

  return {
    equipmentItemId: requirement.equipmentItemId,
    ...details,
    quantityReserved: 0,
    state: "Requested",
    reviewBaseline: null,
    removalRequested: false,
  };
}

/**
 * AC7-9: a change to a reserved line is saved and puts it under review, and
 * what Technical Support reserved stays held -- even above a reduced quantity,
 * since releasing it is their call (SPM-108), not this edit's.
 *
 * AC19: the values the line had when it was Reserved are remembered, so an edit
 * that returns to exactly them clears the review -- Technical Support have
 * nothing to change. Any other edit keeps the original to compare against.
 */
export function editEquipmentRequirement(
  event: CoordinatorEvent,
  line: EquipmentRequirement,
  changes: EquipmentRequirementDetails,
): EquipmentRequirementEdit {
  assertEditable(event);
  assertNotRemovalRequested(line);
  const details = validDetails(changes);

  const changed =
    details.quantityRequested !== line.quantityRequested ||
    details.technicalRequirements !== line.technicalRequirements;
  if (!changed) {
    return { line, changed: false, underReview: false, reviewCleared: false };
  }

  if (line.state === "Under review" && line.reviewBaseline !== null && isBaseline(details, line.reviewBaseline)) {
    return {
      line: { ...line, ...details, state: "Reserved", reviewBaseline: null },
      changed: true,
      underReview: false,
      reviewCleared: true,
    };
  }

  const reserved = isReserved(line);
  return {
    line: {
      ...line,
      ...details,
      state: reserved ? "Under review" : line.state,
      reviewBaseline: reserved ? (line.reviewBaseline ?? baselineOf(line)) : null,
    },
    changed: true,
    underReview: reserved,
    reviewCleared: false,
  };
}

/** AC10-11. */
export function removeEquipmentRequirement(
  event: CoordinatorEvent,
  line: EquipmentRequirement,
): EquipmentRequirementRemoval {
  assertEditable(event);
  assertNotRemovalRequested(line);

  if (!isReserved(line)) {
    return { kind: "deleted" };
  }
  return {
    kind: "removalRequested",
    line: {
      ...line,
      state: "Under review",
      reviewBaseline: line.reviewBaseline ?? baselineOf(line),
      removalRequested: true,
    },
  };
}

/**
 * AC17: the coordinator changed their mind before Technical Support released
 * the equipment, so the line is kept. It stays under review -- Technical
 * Support may already have seen the removal and should re-check either way.
 */
export function undoEquipmentRemoval(
  event: CoordinatorEvent,
  line: EquipmentRequirement,
): EquipmentRequirement {
  assertEditable(event);
  if (!line.removalRequested) {
    throw new EquipmentRemovalNotRequestedError();
  }
  return { ...line, removalRequested: false };
}

function baselineOf(line: EquipmentRequirement): EquipmentReviewBaseline {
  return { quantityRequested: line.quantityRequested, technicalRequirements: line.technicalRequirements };
}

function isBaseline(details: EquipmentRequirementDetails, baseline: EquipmentReviewBaseline): boolean {
  return (
    details.quantityRequested === baseline.quantityRequested &&
    details.technicalRequirements === baseline.technicalRequirements
  );
}

function assertEditable(event: CoordinatorEvent): void {
  if (!equipmentRequirementsEditable(event.status)) {
    throw new EquipmentRequirementsLockedError(event.status);
  }
}

function assertNotRemovalRequested(line: EquipmentRequirement): void {
  if (line.removalRequested) {
    throw new EquipmentRemovalAlreadyRequestedError();
  }
}

/** AC3 and AC5. Blank technical requirements are no technical requirements. */
function validDetails(details: EquipmentRequirementDetails): EquipmentRequirementDetails {
  if (!Number.isInteger(details.quantityRequested) || details.quantityRequested < 1) {
    throw new InvalidEquipmentQuantityError(details.quantityRequested);
  }

  const notes = details.technicalRequirements?.trim() ?? "";
  if (notes.length > TECHNICAL_REQUIREMENTS_MAX_LENGTH) {
    throw new TechnicalRequirementsTooLongError(TECHNICAL_REQUIREMENTS_MAX_LENGTH);
  }

  return {
    quantityRequested: details.quantityRequested,
    technicalRequirements: notes === "" ? null : notes,
  };
}
