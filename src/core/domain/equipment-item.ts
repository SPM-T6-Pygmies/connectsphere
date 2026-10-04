import type { Brand } from "./brand";
import {
  EquipmentLocationRequiredError,
  EquipmentTypeRequiredError,
  InvalidEquipmentItemIdError,
  InvalidEquipmentQuantityError,
} from "./errors";

export type EquipmentItemId = Brand<string, "EquipmentItemId">;

/** The only way to obtain an `EquipmentItemId`. */
export function equipmentItemId(raw: string): EquipmentItemId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidEquipmentItemIdError(raw);
  }
  return trimmed as EquipmentItemId;
}

/**
 * One line of the equipment catalogue (SPM-40).
 *
 * A pooled counter, not one record per physical unit: the system tracks the
 * quantity available and nothing finer (#13). Callers never learn how the
 * store models units, so the catalogue can change that later without them.
 */
export interface EquipmentItem {
  readonly id: EquipmentItemId;
  readonly type: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly location: string;
}

/** A catalogue record the core has built but the store has not yet given an id. */
export type NewEquipmentItem = Omit<EquipmentItem, "id">;

export interface EquipmentItemDetails {
  readonly type: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly location: string;
}

function requiredText(raw: string, error: () => Error): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw error();
  }
  return trimmed;
}

function validQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new InvalidEquipmentQuantityError();
  }
  return quantity;
}

/**
 * SPM-40 AC1: builds a catalogue record. The only way to make one, so a record
 * without a type or location, or with an impossible count, is unrepresentable.
 */
export function newEquipmentItem(details: EquipmentItemDetails): NewEquipmentItem {
  const description = details.description?.trim() ?? "";
  return {
    type: requiredText(details.type, () => new EquipmentTypeRequiredError()),
    description: description.length === 0 ? null : description,
    quantity: validQuantity(details.quantity),
    location: requiredText(details.location, () => new EquipmentLocationRequiredError()),
  };
}

/**
 * SPM-40 AC2: what may change on an existing record -- its quantity and
 * location. The type is what identifies the line, so it stays put.
 */
export function updateEquipmentStock(
  item: EquipmentItem,
  change: { readonly quantity: number; readonly location: string },
): EquipmentItem {
  return {
    ...item,
    quantity: validQuantity(change.quantity),
    location: requiredText(change.location, () => new EquipmentLocationRequiredError()),
  };
}

/** One entry in the equipment catalogue, as a coordinator picks it for an event's requirement (SPM-41 AC1, AC4). */
export type EquipmentCatalogueItem = Pick<EquipmentItem, "id" | "type">;
