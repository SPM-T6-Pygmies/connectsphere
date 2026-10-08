import { equipmentItemId, unitsInService, updateEquipmentStock } from "../domain/equipment-item";
import { eventsHoldingMoreThanInService, type OverheldEvent } from "../domain/equipment-review";
import { EquipmentItemNotFoundError } from "../domain/errors";
import { calendarDate } from "../domain/venue-search";
import { VENUE_TIME_ZONE } from "../domain/venue-unavailability";
import type { Clock } from "../ports/outbound/clock";
import type { EquipmentCatalogue } from "../ports/outbound/equipment-catalogue";

export interface UpdateEquipmentStockCommand {
  readonly equipmentItemId: string;
  readonly quantity: number;
  readonly location: string;
  /** SPM-17 AC1: how many units are out of service. */
  readonly outOfService: number;
}

export interface UpdateEquipmentStockResult {
  readonly equipmentItemId: string;
  readonly quantity: number;
  readonly location: string;
  readonly outOfService: number;
  /**
   * SPM-274 AC7: the upcoming events that, after this save, hold more than is
   * in service. The save goes through regardless; these need sorting out.
   */
  readonly overheld: readonly OverheldEvent[];
}

export interface UpdateEquipmentStockDeps {
  readonly equipment: EquipmentCatalogue;
  /** Which events are upcoming (SPM-274 AC7). */
  readonly clock: Clock;
}

/**
 * SPM-40 AC2, SPM-17 AC1: Technical Support Staff correct an existing line's
 * quantity, location and units out of service. SPM-274 AC7: if that leaves
 * fewer in service than upcoming events hold, it is still saved, and those
 * events are named.
 */
export class UpdateEquipmentStockUseCase {
  constructor(private readonly deps: UpdateEquipmentStockDeps) {}

  /** Throws `EquipmentItemNotFoundError` when no such line exists. */
  async execute(command: UpdateEquipmentStockCommand): Promise<UpdateEquipmentStockResult> {
    const { equipment, clock } = this.deps;
    const id = equipmentItemId(command.equipmentItemId);

    const existing = await equipment.findById(id);
    if (existing === null) {
      throw new EquipmentItemNotFoundError(command.equipmentItemId);
    }

    const updated = updateEquipmentStock(existing, command);
    await equipment.save(updated);

    // ConnectSphere's events, like its venues, run on Singapore time.
    const today = calendarDate(clock.now(), VENUE_TIME_ZONE);
    const reservations = await equipment.reservationsOf(updated.id);

    return {
      equipmentItemId: updated.id,
      quantity: updated.quantity,
      location: updated.location,
      outOfService: updated.outOfService,
      overheld: eventsHoldingMoreThanInService(unitsInService(updated), reservations, today),
    };
  }
}
