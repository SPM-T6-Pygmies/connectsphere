import { equipmentItemId, type EquipmentCatalogueItem } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import {
  DuplicateEquipmentRequirementError,
  EquipmentItemNotInCatalogueError,
  EquipmentRequirementConflictError,
  EquipmentRequirementNotFoundError,
  EquipmentRequirementsLockedError,
  EventNotFoundError,
  type DomainError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";
import type { EventEquipment } from "@/core/ports/outbound/equipment-requirement-repository";

import { lineState } from "./equipment-line-state";

/** A row of `coordinator_equipment_catalogue`. */
export interface EquipmentCatalogueRow {
  equipment_item_id: number;
  type: string;
}

/**
 * A row of `coordinator_event_equipment`: the reservation, and one of its
 * lines -- or all-null line columns for a reservation with no lines.
 */
export interface EventEquipmentRow {
  equipment_reservation_id: number;
  reviewed_by_user_account_id: number | null;
  equipment_item_id: number | null;
  quantity_requested: number | null;
  quantity_reserved: number | null;
  technical_requirements: string | null;
  recheck_required: boolean | null;
  removal_requested: boolean | null;
}

export function toCatalogueItem(row: EquipmentCatalogueRow): EquipmentCatalogueItem {
  return { id: equipmentItemId(String(row.equipment_item_id)), type: row.type };
}

export function toEventEquipment(rows: readonly EventEquipmentRow[]): EventEquipment {
  const first = rows[0];
  if (first === undefined) {
    return { reservation: null, lines: [] };
  }

  return {
    reservation: {
      id: String(first.equipment_reservation_id),
      reviewerUserAccountId:
        first.reviewed_by_user_account_id === null
          ? null
          : userAccountId(String(first.reviewed_by_user_account_id)),
    },
    lines: rows.flatMap((row): EquipmentRequirement[] =>
      row.equipment_item_id === null
        ? []
        : [
            {
              equipmentItemId: equipmentItemId(String(row.equipment_item_id)),
              quantityRequested: row.quantity_requested ?? 0,
              technicalRequirements: row.technical_requirements,
              quantityReserved: row.quantity_reserved ?? 0,
              state: lineState(row.quantity_reserved ?? 0, row.recheck_required ?? false),
              removalRequested: row.removal_requested ?? false,
            },
          ],
    ),
  };
}

/**
 * The domain error a `coordinator_*_equipment_requirement` SQLSTATE stands
 * for -- see their migration -- or null for anything else, which the caller
 * reports as the unexpected failure it is.
 */
export function toEquipmentRequirementError(
  error: { readonly code?: string; readonly details?: string | null },
  context: { readonly eventId: string; readonly equipmentItemId: string },
): DomainError | null {
  switch (error.code) {
    case "CS030":
      return new EventNotFoundError(context.eventId);
    case "CS031":
      return new EquipmentRequirementsLockedError(error.details || "Completed or Cancelled");
    case "CS032":
      return new EquipmentItemNotInCatalogueError(context.equipmentItemId);
    case "CS033":
      return new DuplicateEquipmentRequirementError();
    case "CS034":
      return new EquipmentRequirementNotFoundError(context.equipmentItemId);
    case "CS035":
      return new EquipmentRequirementConflictError();
    default:
      return null;
  }
}
