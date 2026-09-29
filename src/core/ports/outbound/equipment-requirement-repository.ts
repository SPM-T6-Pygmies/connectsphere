import type { EquipmentCatalogueItem, EquipmentItemId } from "../../domain/equipment-item";
import type { EquipmentRequirement } from "../../domain/equipment-requirement";
import type { EventId } from "../../domain/event";
import type { UserAccountId } from "../../domain/user-account";

/**
 * The equipment reservation an event's lines hang off (`equipment_reservation`).
 * An event has none until its first line is recorded.
 */
export interface EquipmentReservationRef {
  readonly id: string;
  /** The Technical Support Staff member reviewing it; null until one picks it up. */
  readonly reviewerUserAccountId: UserAccountId | null;
}

export interface EventEquipment {
  /** Null exactly when `lines` is empty and no line has ever been recorded. */
  readonly reservation: EquipmentReservationRef | null;
  readonly lines: readonly EquipmentRequirement[];
}

/**
 * Driven port: an event's equipment requirement lines (SPM-41), keyed by
 * catalogue item -- an event has at most one line per item (AC2), so the item
 * identifies the line. Whether a change is allowed is the domain's call; this
 * only reads and stores what it decided.
 */
export interface EquipmentRequirementRepository {
  /** Every catalogue item, for picking a type (AC1) and checking one exists (AC4). */
  catalogue(): Promise<readonly EquipmentCatalogueItem[]>;

  forEvent(eventId: EventId): Promise<EventEquipment>;

  /*
   * The writes below take the acting coordinator so a store can re-check the
   * assignment at the moment it writes and record who made the change -- the
   * same reason `CoordinatorEventRepository.confirmEvent` takes `confirmedBy`.
   */

  /**
   * Stores a new line, opening the event's reservation (status Requested) first
   * if it has none. Returns the reservation's id.
   */
  add(eventId: EventId, line: EquipmentRequirement, actor: UserAccountId): Promise<string>;

  /**
   * Replaces the stored line for `line.equipmentItemId`. `line.quantityReserved`
   * is what the domain decided against: a store may refuse the write if
   * Technical Support have reserved against the line since.
   */
  update(eventId: EventId, line: EquipmentRequirement, actor: UserAccountId): Promise<void>;

  /** Deletes the line outright -- only ever for an unreserved line (AC10). */
  delete(eventId: EventId, equipmentItemId: EquipmentItemId, actor: UserAccountId): Promise<void>;
}
