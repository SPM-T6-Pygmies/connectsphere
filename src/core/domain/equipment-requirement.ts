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
 * Technical Support reserve against it, and a change after that flags the line
 * for re-check instead of going through a change request (#114).
 */
export interface EquipmentRequirement {
  readonly equipmentItemId: EquipmentItemId;
  readonly quantityRequested: number;
  readonly technicalRequirements: string | null;
  /** How many Technical Support have reserved against this line -- 0 until they do. */
  readonly quantityReserved: number;
  /** Technical Support must re-check suitability and availability (AC8, AC11). */
  readonly recheckRequired: boolean;
  /**
   * The coordinator removed a reserved line (AC11). It stays, with its
   * equipment held, until Technical Support release it (SPM-108) or the
   * coordinator undoes the removal (AC17).
   */
  readonly removalRequested: boolean;
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
  /** This edit flagged the line for Technical Support to re-check (AC8). */
  readonly flagged: boolean;
}

/**
 * An unreserved line simply goes (AC10). A reserved one stays, flagged, with
 * its equipment held until Technical Support release it (AC11).
 */
export type EquipmentRequirementRemoval =
  | { readonly kind: "deleted" }
  | { readonly kind: "removalRequested"; readonly line: EquipmentRequirement };

/** AC13: requirements can change until the event is Completed or Cancelled. */
export function equipmentRequirementsEditable(status: CoordinatorEventStatus): boolean {
  return status === "Planning" || status === "Blocked" || status === "Confirmed";
}

/** Why a flagged line is on Technical Support's "Needs re-check" list (AC15). */
export type RecheckReason = "changed" | "removalRequested";

/**
 * AC15: whether Technical Support should re-check this line, and why -- null for
 * a line nobody flagged. A line stays flagged after an undone removal (AC17),
 * so it reads as changed.
 */
export function recheckReason(line: EquipmentRequirement): RecheckReason | null {
  if (!line.recheckRequired) {
    return null;
  }
  return line.removalRequested ? "removalRequested" : "changed";
}

/** Whether Technical Support have reserved any equipment against this line yet. */
export function isReserved(line: EquipmentRequirement): boolean {
  return line.quantityReserved > 0;
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
    recheckRequired: false,
    removalRequested: false,
  };
}

/**
 * AC7-9: a change to a reserved line is saved and flagged for re-check, and
 * what Technical Support reserved stays held -- even above a reduced quantity,
 * since releasing it is their call (SPM-108), not this edit's.
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
    return { line, changed: false, flagged: false };
  }

  const flagged = isReserved(line);
  return {
    line: { ...line, ...details, recheckRequired: line.recheckRequired || flagged },
    changed: true,
    flagged,
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
    line: { ...line, recheckRequired: true, removalRequested: true },
  };
}

/**
 * AC17: the coordinator changed their mind before Technical Support released
 * the equipment, so the line is kept. It stays flagged -- Technical Support
 * may already have seen the removal and should re-check either way.
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
