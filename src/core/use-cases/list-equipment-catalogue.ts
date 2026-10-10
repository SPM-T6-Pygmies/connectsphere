import { unitsInService } from "../domain/equipment-item";
import { daysShortOfService, type ShortDays } from "../domain/equipment-review";
import { calendarDate } from "../domain/venue-search";
import { VENUE_TIME_ZONE } from "../domain/venue-unavailability";
import type { Clock } from "../ports/outbound/clock";
import type { EquipmentCatalogue } from "../ports/outbound/equipment-catalogue";

/** One line of the catalogue as the screen shows it -- plain data. */
export interface EquipmentCatalogueEntry {
  readonly id: string;
  readonly type: string;
  readonly description: string | null;
  /** How many are owned, in service or not. */
  readonly quantity: number;
  readonly location: string;
  /** SPM-17 AC3. */
  readonly outOfService: number;
  /** SPM-17 AC3: owned, less out of service. */
  readonly inService: number;
  /** SPM-274 AC7: the days, from today on, on which more are reserved than are in service. */
  readonly shortDays: readonly ShortDays[];
}

export interface ListEquipmentCatalogueResult {
  readonly items: readonly EquipmentCatalogueEntry[];
}

export interface ListEquipmentCatalogueDeps {
  readonly equipment: EquipmentCatalogue;
  /** Which days are upcoming (SPM-274 AC7). */
  readonly clock: Clock;
}

/**
 * SPM-40: what ConnectSphere currently owns. SPM-274 AC7: with, for each
 * item, the days on which upcoming events have reserved more than is in
 * service -- worked out every time the list is read, so the warning stays
 * until the shortfall is gone.
 */
export class ListEquipmentCatalogueUseCase {
  constructor(private readonly deps: ListEquipmentCatalogueDeps) {}

  async execute(): Promise<ListEquipmentCatalogueResult> {
    const { equipment, clock } = this.deps;
    const [items, reservations] = await Promise.all([equipment.list(), equipment.reservations()]);
    // ConnectSphere's events, like its venues, run on Singapore time.
    const today = calendarDate(clock.now(), VENUE_TIME_ZONE);

    return {
      items: items.map((item) => ({
        ...item,
        inService: unitsInService(item),
        shortDays: daysShortOfService(unitsInService(item), reservations.get(item.id) ?? [], today),
      })),
    };
  }
}
