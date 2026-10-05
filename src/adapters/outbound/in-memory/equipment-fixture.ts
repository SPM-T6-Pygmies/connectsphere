import type { EquipmentCatalogueItem } from "@/core/domain/equipment-item";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
import type { EventEquipment } from "@/core/ports/outbound/equipment-requirement-repository";
import { SafetyCheckEntryAnnouncer } from "@/core/use-cases/announce-safety-check-entry";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "./in-memory-coordinator-event-repository";
import { InMemoryEquipmentRequirementRepository } from "./in-memory-equipment-requirement-repository";
import { InMemorySafetyCheckWatch } from "./in-memory-safety-check-watch";
import { RecordingNotifier } from "./recording-notifier";

/** Shared test data for the SPM-41 equipment requirement use cases. */

export const COORDINATOR = "coordinator-1";
export const OTHER_COORDINATOR = "coordinator-2";
export const REVIEWER = userAccountId("support-1");

export const PROJECTOR = equipmentItemId("item-projector");
export const MICROPHONE = equipmentItemId("item-microphone");
export const SPEAKER = equipmentItemId("item-speaker");

export const CATALOGUE: readonly EquipmentCatalogueItem[] = [
  { id: PROJECTOR, type: "Projector" },
  { id: MICROPHONE, type: "Wireless microphone" },
  { id: SPEAKER, type: "PA speaker" },
];

export function seedEvent(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Founders' Gala Dinner",
    clientOrganisationName: "Test Organisation",
    preferredDate: "2026-12-12",
    status: "Planning",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: null,
    expectedAttendance: 220,
    statedEquipmentNeeds: null,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    ...overrides,
  };
}

/** A line with nothing reserved; give it `quantityReserved` and it is `Reserved`, or pass `state: "Under review"`. */
export function line(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  const quantityReserved = overrides.quantityReserved ?? 0;
  const built: EquipmentRequirement = {
    equipmentItemId: MICROPHONE,
    quantityRequested: 4,
    technicalRequirements: null,
    quantityReserved,
    state: quantityReserved > 0 ? "Reserved" : "Requested",
    reviewBaseline: null,
    removalRequested: false,
    ...overrides,
  };
  // A line under review always remembers what it was reviewed as; default to its own values.
  return built.state === "Under review" && built.reviewBaseline === null && overrides.reviewBaseline === undefined
    ? {
        ...built,
        reviewBaseline: { quantityRequested: built.quantityRequested, technicalRequirements: built.technicalRequirements },
      }
    : built;
}

/** Projector x2, both reserved by REVIEWER; Wireless microphone x4, none reserved. */
export function seededEquipment(): EventEquipment {
  return {
    reservation: { id: "reservation-10", reviewerUserAccountId: REVIEWER },
    lines: [
      line({
        equipmentItemId: PROJECTOR,
        quantityRequested: 2,
        quantityReserved: 2,
        technicalRequirements: "HDMI input",
      }),
      line(),
    ],
  };
}

export function buildEquipmentDeps(
  events: readonly SeedCoordinatorEvent[] = [seedEvent()],
  equipment: Readonly<Record<string, EventEquipment>> = { "event-1": seededEquipment() },
) {
  const eventsRepo = new InMemoryCoordinatorEventRepository(events);
  const equipmentRepo = new InMemoryEquipmentRequirementRepository(CATALOGUE, equipment);
  const safetyWatch = new InMemorySafetyCheckWatch([], ["safety-1", "safety-2"]);
  const notifier = new RecordingNotifier();
  return {
    events: eventsRepo,
    equipment: equipmentRepo,
    safetyWatch,
    notifier,
    safetyCheck: new SafetyCheckEntryAnnouncer({ watch: safetyWatch, notifier }),
  };
}

/**
 * SPM-262: has the safety watch see event-1 as it stands in the equipment store
 * -- one Confirmed venue booking and whatever lines are stored -- before and
 * after each write, as the real store's read would.
 */
export function watchEquipmentForSafety(deps: ReturnType<typeof buildEquipmentDeps>): void {
  const { equipment, safetyWatch } = deps;
  const refresh = () =>
    safetyWatch.set({
      event: {
        id: eventId("event-1"),
        name: "Founders' Gala Dinner",
        status: "Planning",
        preferredDate: "2026-12-12",
        expectedAttendance: 220,
      },
      bookings: [{ status: "Confirmed", venueName: "Grand Ballroom" }],
      equipmentLines: equipment.stored("event-1").lines,
    });

  refresh();
  for (const method of ["update", "delete"] as const) {
    const write = equipment[method].bind(equipment) as (...args: unknown[]) => Promise<void>;
    (equipment as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
      await write(...args);
      refresh();
    };
  }
}
