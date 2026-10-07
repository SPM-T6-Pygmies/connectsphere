import type { CoordinatorEventStatus } from "../../domain/coordinator-event";
import type { EquipmentRequirement } from "../../domain/equipment-requirement";
import type { EventId } from "../../domain/event";
import type { UserAccountId } from "../../domain/user-account";

/** An event, as much of it as Technical Support's lists show. */
export interface TechnicalEquipmentEvent {
  readonly id: EventId;
  readonly name: string;
  readonly status: CoordinatorEventStatus;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
}

export interface EventWithEquipment {
  readonly event: TechnicalEquipmentEvent;
  readonly lines: readonly EquipmentRequirement[];
}

/**
 * Driven port: every event's equipment lines, as Technical Support Staff see
 * them (SPM-273) -- across every venue, coordinator and equipment type (#66).
 * Which list an event belongs on is the domain's call (`equipmentQueueOf`),
 * not the store's.
 */
export interface TechnicalEquipmentRepository {
  /**
   * Every event with at least one equipment line, whatever its status, soonest
   * first and undated last. Takes the reader so a store can re-check they are
   * Technical Support Staff at the moment it reads.
   */
  eventsWithEquipment(reader: UserAccountId): Promise<readonly EventWithEquipment[]>;
}
