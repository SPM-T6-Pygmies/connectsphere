import type { EquipmentCatalogueItem } from "@/core/domain/equipment-item";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { userAccountId } from "@/core/domain/user-account";
import type { EventEquipment } from "@/core/ports/outbound/equipment-requirement-repository";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "./in-memory-coordinator-event-repository";
import { InMemoryEquipmentRequirementRepository } from "./in-memory-equipment-requirement-repository";

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

export function line(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  return {
    equipmentItemId: MICROPHONE,
    quantityRequested: 4,
    technicalRequirements: null,
    quantityReserved: 0,
    recheckRequired: false,
    removalRequested: false,
    ...overrides,
  };
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
  return { events: eventsRepo, equipment: equipmentRepo };
}
