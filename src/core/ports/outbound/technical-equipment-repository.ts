import type { CoordinatorEventStatus } from "../../domain/coordinator-event";
import type { EquipmentRequirement } from "../../domain/equipment-requirement";
import type { EquipmentHold } from "../../domain/equipment-review";
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

/** One of an event's lines, with what AC4 needs to say how many units are free for it. */
export interface EquipmentLineStock {
  readonly line: EquipmentRequirement;
  readonly equipmentType: string;
  /** How many units of the type ConnectSphere owns. */
  readonly owned: number;
  /** How many of those are out of service (SPM-17). */
  readonly outOfService: number;
  /** What every other event has reserved of the type. Which of them overlap is `unitsAvailable`'s call. */
  readonly otherHolds: readonly EquipmentHold[];
}

export interface EventEquipmentStock {
  readonly event: TechnicalEquipmentEvent;
  readonly lines: readonly EquipmentLineStock[];
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

  /** One event's lines, ordered by type, or null when there is no such event. Re-checks the reader the same way. */
  eventEquipment(reader: UserAccountId, eventId: EventId): Promise<EventEquipmentStock | null>;
}
