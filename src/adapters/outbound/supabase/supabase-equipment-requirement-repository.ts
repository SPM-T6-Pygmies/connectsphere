import type { EquipmentCatalogueItem, EquipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { EquipmentItemNotInCatalogueError, EventNotFoundError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EquipmentRequirementRepository,
  EventEquipment,
} from "@/core/ports/outbound/equipment-requirement-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import {
  toCatalogueItem,
  toEquipmentRequirementError,
  toEventEquipment,
  type EquipmentCatalogueRow,
  type EventEquipmentRow,
} from "./equipment-requirement-mapper";

/**
 * SPM-41, through the `coordinator_*equipment*` functions, not the tables --
 * RLS is on with no policies and their grants were revoked. Every write
 * re-checks the assignment and the event's status under a row lock and writes
 * its audit row in the same transaction; the functions' SQLSTATEs come back as
 * the domain's own errors, so losing a race reads like losing it a moment
 * earlier rather than a 500.
 */
export class SupabaseEquipmentRequirementRepository implements EquipmentRequirementRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async catalogue(): Promise<readonly EquipmentCatalogueItem[]> {
    const { data, error } = await this.client.rpc("coordinator_equipment_catalogue");

    if (error) {
      throw new Error(`Failed to list the equipment catalogue: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as EquipmentCatalogueRow[]).map(toCatalogueItem);
  }

  async forEvent(eventId: EventId): Promise<EventEquipment> {
    const key = toKey(eventId);
    if (key === null) {
      return { reservation: null, lines: [] };
    }

    const { data, error } = await this.client.rpc("coordinator_event_equipment", { p_event_id: key });

    if (error) {
      throw new Error(`Failed to read the event's equipment: ${error.message}`, { cause: error });
    }

    return toEventEquipment((data ?? []) as unknown as EventEquipmentRow[]);
  }

  async add(eventId: EventId, line: EquipmentRequirement, actor: UserAccountId): Promise<string> {
    const keys = this.keys(eventId, line.equipmentItemId, actor);

    const { data, error } = await this.client.rpc("coordinator_add_equipment_requirement", {
      ...keys,
      p_quantity_requested: line.quantityRequested,
      p_technical_requirements: line.technicalRequirements,
    });

    if (error) {
      throw this.failure("record", error, eventId, line.equipmentItemId);
    }

    return String(data);
  }

  async update(eventId: EventId, line: EquipmentRequirement, actor: UserAccountId): Promise<void> {
    const keys = this.keys(eventId, line.equipmentItemId, actor);

    const { error } = await this.client.rpc("coordinator_update_equipment_requirement", {
      ...keys,
      p_quantity_requested: line.quantityRequested,
      p_technical_requirements: line.technicalRequirements,
      p_removal_requested: line.removalRequested,
      p_quantity_reserved_seen: line.quantityReserved,
    });

    if (error) {
      throw this.failure("update", error, eventId, line.equipmentItemId);
    }
  }

  async delete(eventId: EventId, equipmentItemId: EquipmentItemId, actor: UserAccountId): Promise<void> {
    const keys = this.keys(eventId, equipmentItemId, actor);

    const { error } = await this.client.rpc("coordinator_delete_equipment_requirement", keys);

    if (error) {
      throw this.failure("delete", error, eventId, equipmentItemId);
    }
  }

  /** The functions' shared arguments. Ids this store could never have issued mean the row does not exist. */
  private keys(eventId: EventId, equipmentItemId: EquipmentItemId, actor: UserAccountId) {
    const eventKey = toKey(eventId);
    const actorKey = toKey(actor);
    if (eventKey === null || actorKey === null) {
      throw new EventNotFoundError(eventId);
    }
    const itemKey = toKey(equipmentItemId);
    if (itemKey === null) {
      throw new EquipmentItemNotInCatalogueError(equipmentItemId);
    }
    return {
      p_event_id: eventKey,
      p_coordinator_user_account_id: actorKey,
      p_equipment_item_id: itemKey,
    };
  }

  private failure(
    action: string,
    error: { readonly code?: string; readonly details?: string | null; readonly message: string },
    eventId: EventId,
    equipmentItemId: EquipmentItemId,
  ): Error {
    return (
      toEquipmentRequirementError(error, { eventId, equipmentItemId }) ??
      new Error(`Failed to ${action} an equipment requirement: ${error.message}`, { cause: error })
    );
  }
}
