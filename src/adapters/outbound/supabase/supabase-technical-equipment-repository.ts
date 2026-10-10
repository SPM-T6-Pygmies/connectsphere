import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { NotTechnicalSupportStaffError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventEquipmentStock,
  EventWithEquipment,
  TechnicalEquipmentRepository,
} from "@/core/ports/outbound/technical-equipment-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import {
  toEventEquipmentStock,
  toEventWithEquipment,
  toTechnicalEquipmentError,
  type TechnicalEquipmentEventRow,
  type TechnicalEventEquipmentRow,
} from "./technical-equipment-mapper";

/**
 * SPM-273, through `technical_support_equipment_events` and
 * `technical_support_event_equipment`, and SPM-274, through
 * `technical_support_reserve_equipment` and
 * `technical_support_mark_equipment_unfulfilled` -- not the tables, as RLS is
 * on with no policies. Each re-checks that the caller is Technical Support
 * Staff and answers CS040 if not, which comes back as the domain's own error.
 */
export class SupabaseTechnicalEquipmentRepository implements TechnicalEquipmentRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async eventsWithEquipment(reader: UserAccountId): Promise<readonly EventWithEquipment[]> {
    const { data, error } = await this.client.rpc("technical_support_equipment_events", {
      p_user_account_id: readerKey(reader),
    });

    if (error) {
      throw (
        toTechnicalEquipmentError(error) ??
        new Error(`Failed to read the events with equipment: ${error.message}`, { cause: error })
      );
    }

    return ((data ?? []) as unknown as TechnicalEquipmentEventRow[]).map(toEventWithEquipment);
  }

  async eventEquipment(reader: UserAccountId, eventId: EventId): Promise<EventEquipmentStock | null> {
    const key = toKey(eventId);
    if (key === null) {
      // An id this store could never have issued names no event.
      return null;
    }

    const { data, error } = await this.client.rpc("technical_support_event_equipment", {
      p_user_account_id: readerKey(reader),
      p_event_id: key,
    });

    if (error) {
      throw (
        toTechnicalEquipmentError(error) ??
        new Error(`Failed to read event ${eventId}'s equipment: ${error.message}`, { cause: error })
      );
    }

    const [row] = (data ?? []) as unknown as TechnicalEventEquipmentRow[];
    return row === undefined ? null : toEventEquipmentStock(row);
  }

  async reserve(reviewer: UserAccountId, eventId: EventId, line: EquipmentRequirement): Promise<void> {
    const { error } = await this.client.rpc("technical_support_reserve_equipment", {
      p_user_account_id: readerKey(reviewer),
      p_event_id: writeKey(eventId),
      p_equipment_item_id: writeKey(line.equipmentItemId),
      p_quantity: line.quantityReserved,
    });

    if (error) {
      throw (
        toTechnicalEquipmentError(error, line) ??
        new Error(`Failed to reserve ${line.equipmentItemId} for event ${eventId}: ${error.message}`, { cause: error })
      );
    }
  }

  async markUnfulfilled(reviewer: UserAccountId, eventId: EventId, line: EquipmentRequirement): Promise<void> {
    const { error } = await this.client.rpc("technical_support_mark_equipment_unfulfilled", {
      p_user_account_id: readerKey(reviewer),
      p_event_id: writeKey(eventId),
      p_equipment_item_id: writeKey(line.equipmentItemId),
      p_quantity_requested_seen: line.quantityRequested,
      p_comment: line.decision?.comment ?? "",
    });

    if (error) {
      throw (
        toTechnicalEquipmentError(error, line) ??
        new Error(`Failed to mark ${line.equipmentItemId} unfulfilled for event ${eventId}: ${error.message}`, {
          cause: error,
        })
      );
    }
  }
}

/** The domain only writes to a line it read from this store, so an id it could not have issued is a bug. */
function writeKey(id: string): number {
  const key = toKey(id);
  if (key === null) {
    throw new Error(`"${id}" is not an id this store issued.`);
  }
  return key;
}

function readerKey(reader: UserAccountId): number {
  const key = toKey(reader);
  if (key === null) {
    // An id this store could never have issued is not Technical Support Staff.
    throw new NotTechnicalSupportStaffError();
  }
  return key;
}
