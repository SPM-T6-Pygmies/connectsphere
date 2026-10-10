import type { EquipmentItem, EquipmentItemId, NewEquipmentItem } from "@/core/domain/equipment-item";
import type { EventReservation } from "@/core/domain/equipment-review";
import { NotTechnicalSupportStaffError } from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type { EquipmentCatalogue } from "@/core/ports/outbound/equipment-catalogue";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import {
  toEquipmentCatalogueError,
  toEquipmentItem,
  toEventReservations,
  type EquipmentCatalogueItemRow,
  type EquipmentReservationRow,
} from "./equipment-catalogue-mapper";

/**
 * SPM-40 and SPM-17, through the Technical Support catalogue functions, not
 * the table -- RLS is on with no policies. Built for the acting Technical
 * Support Staff member, whom every function re-checks (CS040), so the port
 * stays free of who is asking. It reads and writes the same `equipment_item`
 * rows coordinators pick from (SPM-17 AC5), and reads what events have
 * reserved of an item (SPM-274 AC7).
 */
export class SupabaseEquipmentCatalogue implements EquipmentCatalogue {
  constructor(
    private readonly client: SupabaseServerClient,
    private readonly actor: UserAccountId | null,
  ) {}

  async list(): Promise<readonly EquipmentItem[]> {
    const { data, error } = await this.client.rpc("technical_support_equipment_catalogue", {
      p_user_account_id: this.actorKey(),
    });

    if (error) {
      throw (
        toEquipmentCatalogueError(error) ??
        new Error(`Failed to list the equipment catalogue: ${error.message}`, { cause: error })
      );
    }

    return ((data ?? []) as unknown as EquipmentCatalogueItemRow[]).map(toEquipmentItem);
  }

  /** The catalogue is a short list, so one item is found within it rather than by a function of its own. */
  async findById(id: EquipmentItemId): Promise<EquipmentItem | null> {
    return (await this.list()).find((item) => item.id === id) ?? null;
  }

  async create(item: NewEquipmentItem): Promise<EquipmentItem> {
    const { data, error } = await this.client.rpc("technical_support_create_equipment_item", {
      p_user_account_id: this.actorKey(),
      p_type: item.type,
      p_description: item.description,
      p_quantity: item.quantity,
      p_location: item.location,
    });

    const [row] = (data ?? []) as unknown as EquipmentCatalogueItemRow[];
    if (error || row === undefined) {
      throw (
        (error && toEquipmentCatalogueError(error)) ??
        new Error(`Failed to add ${item.type} to the catalogue: ${error?.message ?? "no row returned"}`, {
          cause: error,
        })
      );
    }

    return toEquipmentItem(row);
  }

  async save(item: EquipmentItem): Promise<void> {
    const key = toKey(item.id);
    if (key === null) {
      throw new Error(`Cannot save equipment item ${item.id}: it was never created.`);
    }

    const { error } = await this.client.rpc("technical_support_update_equipment_item", {
      p_user_account_id: this.actorKey(),
      p_equipment_item_id: key,
      p_quantity: item.quantity,
      p_location: item.location,
      p_out_of_service: item.outOfService,
    });

    if (error) {
      throw (
        toEquipmentCatalogueError(error, item) ??
        new Error(`Failed to save equipment item ${item.id}: ${error.message}`, { cause: error })
      );
    }
  }

  async reservations(): Promise<ReadonlyMap<EquipmentItemId, readonly EventReservation[]>> {
    const { data, error } = await this.client.rpc("technical_support_equipment_reservations", {
      p_user_account_id: this.actorKey(),
    });

    if (error) {
      throw (
        toEquipmentCatalogueError(error) ??
        new Error(`Failed to read the equipment reservations: ${error.message}`, { cause: error })
      );
    }

    return toEventReservations((data ?? []) as unknown as EquipmentReservationRow[]);
  }

  private actorKey(): number {
    const key = this.actor === null ? null : toKey(this.actor);
    if (key === null) {
      // No acting member, or an id this store could never have issued: not Technical Support Staff.
      throw new NotTechnicalSupportStaffError();
    }
    return key;
  }
}
