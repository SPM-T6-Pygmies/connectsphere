import { equipmentItemId } from "@/core/domain/equipment-item";
import { NotTechnicalSupportStaffError, type DomainError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import type { FlaggedEquipmentLine } from "@/core/ports/outbound/equipment-recheck-repository";

/** A row of `technical_support_equipment_rechecks`: one flagged line, with its event and type. */
export interface FlaggedEquipmentRow {
  event_id: number;
  event_name: string;
  preferred_date: string | null;
  equipment_item_id: number;
  equipment_type: string;
  quantity_requested: number;
  quantity_reserved: number;
  technical_requirements: string | null;
  recheck_required: boolean;
  removal_requested: boolean;
}

export function toFlaggedEquipmentLine(row: FlaggedEquipmentRow): FlaggedEquipmentLine {
  return {
    event: { id: eventId(String(row.event_id)), name: row.event_name, preferredDate: row.preferred_date },
    equipmentType: row.equipment_type,
    line: {
      equipmentItemId: equipmentItemId(String(row.equipment_item_id)),
      quantityRequested: row.quantity_requested,
      technicalRequirements: row.technical_requirements,
      quantityReserved: row.quantity_reserved,
      recheckRequired: row.recheck_required,
      removalRequested: row.removal_requested,
    },
  };
}

/**
 * The domain error a `technical_support_equipment_rechecks` SQLSTATE stands
 * for -- see its migration -- or null for anything else, which the caller
 * reports as the unexpected failure it is.
 */
export function toEquipmentRecheckError(error: { readonly code?: string }): DomainError | null {
  return error.code === "CS040" ? new NotTechnicalSupportStaffError() : null;
}
