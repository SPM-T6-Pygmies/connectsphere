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
 * `technical_support_event_equipment`, not the tables -- RLS is on with no
 * policies. Both re-check that the reader is Technical Support Staff and
 * answer CS040 if not, which comes back as the domain's own error.
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
}

function readerKey(reader: UserAccountId): number {
  const key = toKey(reader);
  if (key === null) {
    // An id this store could never have issued is not Technical Support Staff.
    throw new NotTechnicalSupportStaffError();
  }
  return key;
}
