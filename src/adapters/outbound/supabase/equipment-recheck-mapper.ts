import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentLineState } from "@/core/domain/equipment-requirement";
import { NotTechnicalSupportStaffError, type DomainError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import type { UnderReviewEquipmentLine } from "@/core/ports/outbound/equipment-recheck-repository";

import { toReviewBaseline } from "./equipment-requirement-mapper";

/** A row of `technical_support_equipment_rechecks`: one line under review, with its event and type. */
export interface UnderReviewEquipmentRow {
  event_id: number;
  event_name: string;
  preferred_date: string | null;
  equipment_item_id: number;
  equipment_type: string;
  quantity_requested: number;
  quantity_reserved: number;
  technical_requirements: string | null;
  line_state: EquipmentLineState;
  reviewed_quantity_requested: number | null;
  reviewed_technical_requirements: string | null;
  removal_requested: boolean;
}

export function toUnderReviewEquipmentLine(row: UnderReviewEquipmentRow): UnderReviewEquipmentLine {
  return {
    event: { id: eventId(String(row.event_id)), name: row.event_name, preferredDate: row.preferred_date },
    equipmentType: row.equipment_type,
    line: {
      equipmentItemId: equipmentItemId(String(row.equipment_item_id)),
      quantityRequested: row.quantity_requested,
      technicalRequirements: row.technical_requirements,
      quantityReserved: row.quantity_reserved,
      state: row.line_state,
      reviewBaseline: toReviewBaseline(row.reviewed_quantity_requested, row.reviewed_technical_requirements),
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
