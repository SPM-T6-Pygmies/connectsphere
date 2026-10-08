import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentLineState, EquipmentRequirement } from "@/core/domain/equipment-requirement";
import {
  EquipmentLineNotAwaitingDecisionError,
  EquipmentRequirementNotFoundError,
  EventDateRequiredForEquipmentError,
  NotEnoughEquipmentAvailableError,
  NotTechnicalSupportStaffError,
  type DomainError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
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
  /** SPM-274: who last reserved the line or marked it unfulfilled, their name, and why not. */
  decided_by_user_account_id: number | null;
  decided_by_name: string | null;
  decision_comment: string | null;
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
    decision:
      row.decided_by_user_account_id === null
        ? null
        : { by: userAccountId(String(row.decided_by_user_account_id)), comment: row.decision_comment },
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
      decidedByName: line.decided_by_name,
    })),
  };
}

/**
 * The domain error a Technical Support function's SQLSTATE stands for -- see
 * its migration -- or null for anything else, which the caller reports as the
 * unexpected failure it is. The writes pass the line they wrote, which the
 * SPM-274 errors name.
 */
export function toTechnicalEquipmentError(
  error: { readonly code?: string; readonly details?: string | null },
  line?: { readonly equipmentItemId: string; readonly quantityRequested: number },
): DomainError | null {
  switch (error.code) {
    case "CS040":
      return new NotTechnicalSupportStaffError();
    case "CS043":
      return line === undefined ? null : new EquipmentRequirementNotFoundError(line.equipmentItemId);
    case "CS044":
      return new EventDateRequiredForEquipmentError();
    case "CS045":
      return new EquipmentLineNotAwaitingDecisionError();
    case "CS046":
      return line === undefined ? null : new NotEnoughEquipmentAvailableError(Number(error.details), line.quantityRequested);
    default:
      return null;
  }
}
