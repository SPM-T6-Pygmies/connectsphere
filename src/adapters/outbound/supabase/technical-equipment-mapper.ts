import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentLineState, EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { NotTechnicalSupportStaffError, type DomainError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import type {
  EventEquipmentStock,
  EventWithEquipment,
  TechnicalEquipmentEvent,
} from "@/core/ports/outbound/technical-equipment-repository";

import { toReviewBaseline } from "./equipment-requirement-mapper";

/** One equipment line, as both Technical Support functions spell it. */
export interface TechnicalEquipmentLineRow {
  equipment_item_id: number;
  quantity_requested: number;
  quantity_reserved: number;
  technical_requirements: string | null;
  line_state: EquipmentLineState;
  reviewed_quantity_requested: number | null;
  reviewed_technical_requirements: string | null;
  removal_requested: boolean;
}

/** A line of `technical_support_event_equipment`, with its type's stock and other events' holds. */
export interface TechnicalEquipmentStockRow extends TechnicalEquipmentLineRow {
  equipment_type: string;
  owned: number;
  out_of_service: number;
  other_holds: { event_status: CoordinatorEventStatus; preferred_date: string | null; quantity_reserved: number }[];
}

interface EventColumns {
  event_id: number;
  event_name: string;
  status: CoordinatorEventStatus;
  preferred_date: string | null;
}

/** A row of `technical_support_equipment_events`: one event with its lines. */
export interface TechnicalEquipmentEventRow extends EventColumns {
  lines: TechnicalEquipmentLineRow[];
}

/** The row of `technical_support_event_equipment`: the event with its lines and their stock. */
export interface TechnicalEventEquipmentRow extends EventColumns {
  lines: TechnicalEquipmentStockRow[];
}

function toEvent(row: EventColumns): TechnicalEquipmentEvent {
  return {
    id: eventId(String(row.event_id)),
    name: row.event_name,
    status: row.status,
    preferredDate: row.preferred_date,
  };
}

function toLine(row: TechnicalEquipmentLineRow): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId(String(row.equipment_item_id)),
    quantityRequested: row.quantity_requested,
    technicalRequirements: row.technical_requirements,
    quantityReserved: row.quantity_reserved,
    state: row.line_state,
    reviewBaseline: toReviewBaseline(row.reviewed_quantity_requested, row.reviewed_technical_requirements),
    removalRequested: row.removal_requested,
    decision: null,
  };
}

export function toEventWithEquipment(row: TechnicalEquipmentEventRow): EventWithEquipment {
  return { event: toEvent(row), lines: row.lines.map(toLine) };
}

export function toEventEquipmentStock(row: TechnicalEventEquipmentRow): EventEquipmentStock {
  return {
    event: toEvent(row),
    lines: row.lines.map((line) => ({
      line: toLine(line),
      equipmentType: line.equipment_type,
      owned: line.owned,
      outOfService: line.out_of_service,
      otherHolds: line.other_holds.map((hold) => ({
        eventStatus: hold.event_status,
        eventDate: hold.preferred_date,
        quantityReserved: hold.quantity_reserved,
      })),
    })),
  };
}

/**
 * The domain error a Technical Support function's SQLSTATE stands for -- see
 * its migration -- or null for anything else, which the caller reports as the
 * unexpected failure it is.
 */
export function toTechnicalEquipmentError(error: { readonly code?: string }): DomainError | null {
  return error.code === "CS040" ? new NotTechnicalSupportStaffError() : null;
}
