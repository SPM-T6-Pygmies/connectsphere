import type { CoordinatorEvent } from "../domain/coordinator-event";
import type { EquipmentCatalogueItem, EquipmentItemId } from "../domain/equipment-item";
import {
  EquipmentItemNotInCatalogueError,
  EquipmentRequirementNotFoundError,
  EventNotFoundError,
} from "../domain/errors";
import type { EquipmentRequirement } from "../domain/equipment-requirement";
import type { UserAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type {
  EquipmentReservationRef,
  EventEquipment,
} from "../ports/outbound/equipment-requirement-repository";

/**
 * What one change to an event's equipment requirements did (SPM-41) -- enough
 * for SPM-64 to tell Technical Support about it without asking again: which
 * event, which line, from what quantity to what, and whether the change flagged
 * the line for re-check.
 */
export interface EquipmentRequirementChange {
  readonly action: "recorded" | "edited" | "deleted" | "removalRequested" | "removalUndone";
  readonly event: {
    readonly id: string;
    readonly name: string;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
  };
  readonly reservationId: string;
  /** Who at Technical Support is reviewing the reservation; null until someone picks it up. */
  readonly reviewerUserAccountId: string | null;
  readonly equipmentItemId: string;
  readonly equipmentType: string;
  /** Null for a newly recorded line. */
  readonly quantityBefore: number | null;
  /** Null once the line is deleted. */
  readonly quantityAfter: number | null;
  /** False only for an edit that changed nothing (AC9): nothing was stored and nobody need be told. */
  readonly changed: boolean;
  /** This change flagged the line for Technical Support to re-check (AC8, AC11). */
  readonly flagged: boolean;
}

/**
 * AC14: the event, if the caller is its assigned coordinator. Anyone else gets
 * the same answer as for an event that does not exist, as `ConfirmEventUseCase`
 * gives, so a guess cannot confirm an event exists (#91).
 */
export async function assignedEvent(
  events: CoordinatorEventRepository,
  id: CoordinatorEvent["id"],
  caller: UserAccountId,
): Promise<CoordinatorEvent> {
  const event = await events.findById(id);
  if (event === null || event.assignedCoordinatorUserAccountId !== caller) {
    throw new EventNotFoundError(id);
  }
  return event;
}

export function catalogueItem(
  catalogue: readonly EquipmentCatalogueItem[],
  id: EquipmentItemId,
): EquipmentCatalogueItem {
  const item = catalogue.find((entry) => entry.id === id);
  if (item === undefined) {
    throw new EquipmentItemNotInCatalogueError(id);
  }
  return item;
}

/** The event's line for one catalogue item, and the reservation it belongs to. */
export function existingLine(
  equipment: EventEquipment,
  id: EquipmentItemId,
): { readonly line: EquipmentRequirement; readonly reservation: EquipmentReservationRef } {
  const line = equipment.lines.find((entry) => entry.equipmentItemId === id);
  if (line === undefined || equipment.reservation === null) {
    throw new EquipmentRequirementNotFoundError(id);
  }
  return { line, reservation: equipment.reservation };
}

export function describeChange(params: {
  readonly action: EquipmentRequirementChange["action"];
  readonly event: CoordinatorEvent;
  readonly reservation: EquipmentReservationRef;
  readonly item: EquipmentCatalogueItem;
  readonly before: EquipmentRequirement | null;
  readonly after: EquipmentRequirement | null;
  readonly changed: boolean;
  readonly flagged: boolean;
}): EquipmentRequirementChange {
  const { action, event, reservation, item, before, after, changed, flagged } = params;
  return {
    action,
    event: { id: event.id, name: event.name, preferredDate: event.preferredDate },
    reservationId: reservation.id,
    reviewerUserAccountId: reservation.reviewerUserAccountId,
    equipmentItemId: item.id,
    equipmentType: item.type,
    quantityBefore: before?.quantityRequested ?? null,
    quantityAfter: after?.quantityRequested ?? null,
    changed,
    flagged,
  };
}
