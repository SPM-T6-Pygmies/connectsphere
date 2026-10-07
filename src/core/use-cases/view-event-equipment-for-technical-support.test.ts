import { describe, expect, it } from "vitest";

import { InMemoryTechnicalEquipmentRepository } from "@/adapters/outbound/in-memory/in-memory-technical-equipment-repository";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { eventId } from "@/core/domain/event";
import type {
  EquipmentLineStock,
  EventEquipmentStock,
} from "@/core/ports/outbound/technical-equipment-repository";

import { ViewEventEquipmentForTechnicalSupportUseCase } from "./view-event-equipment-for-technical-support";

const SUPPORT = "support-1";

function line(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId("item-projector"),
    quantityRequested: 2,
    technicalRequirements: "HDMI input",
    quantityReserved: 2,
    state: "Reserved",
    reviewBaseline: null,
    removalRequested: false,
    ...overrides,
  };
}

function stock(overrides: Partial<EquipmentLineStock> = {}): EquipmentLineStock {
  return { line: line(), equipmentType: "Projector", owned: 10, otherHolds: [], ...overrides };
}

function event(lines: readonly EquipmentLineStock[], preferredDate: string | null = "2026-11-15"): EventEquipmentStock {
  return {
    event: { id: eventId("event-1"), name: "Founders' Gala Dinner", status: "Planning", preferredDate },
    lines,
  };
}

function view(seed: readonly EventEquipmentStock[], id = "event-1") {
  return new ViewEventEquipmentForTechnicalSupportUseCase({
    equipment: new InMemoryTechnicalEquipmentRepository(seed),
  }).execute({ eventId: id, userAccountId: SUPPORT });
}

describe("ViewEventEquipmentForTechnicalSupportUseCase (SPM-273)", () => {
  it("AC3: shows every line's type, quantity requested, quantity reserved and technical requirements", async () => {
    const result = await view([
      event([
        stock(),
        stock({
          line: line({
            equipmentItemId: equipmentItemId("item-microphone"),
            quantityRequested: 4,
            quantityReserved: 0,
            technicalRequirements: null,
            state: "Requested",
          }),
          equipmentType: "Wireless microphone",
        }),
      ]),
    ]);

    expect(result?.event).toEqual({
      id: "event-1",
      name: "Founders' Gala Dinner",
      status: "Planning",
      preferredDate: "2026-11-15",
    });
    expect(result?.lines).toEqual([
      {
        equipmentItemId: "item-projector",
        equipmentType: "Projector",
        quantityRequested: 2,
        quantityReserved: 2,
        technicalRequirements: "HDMI input",
        attention: null,
        reservedAs: null,
        available: 10,
      },
      {
        equipmentItemId: "item-microphone",
        equipmentType: "Wireless microphone",
        quantityRequested: 4,
        quantityReserved: 0,
        technicalRequirements: null,
        attention: "new",
        reservedAs: null,
        available: 10,
      },
    ]);
  });

  it("AC3: marks a changed line and shows what it was when it was reserved", async () => {
    const result = await view([
      event([
        stock({
          line: line({
            quantityRequested: 3,
            state: "Under review",
            reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
          }),
        }),
      ]),
    ]);

    expect(result?.lines[0]).toMatchObject({
      attention: "changed",
      reservedAs: { quantityRequested: 2, technicalRequirements: "HDMI input" },
    });
  });

  it("AC3: marks a line whose removal was requested", async () => {
    const result = await view([
      event([
        stock({
          line: line({
            state: "Under review",
            reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
            removalRequested: true,
          }),
        }),
      ]),
    ]);

    expect(result?.lines[0]).toMatchObject({ attention: "removalRequested", reservedAs: null });
  });

  it("AC4: counts what other active events one day either side hold against the units owned", async () => {
    const result = await view([
      event([
        stock({
          owned: 10,
          otherHolds: [
            { eventStatus: "Planning", eventDate: "2026-11-14", quantityReserved: 3 },
            { eventStatus: "Confirmed", eventDate: "2026-11-15", quantityReserved: 2 },
            { eventStatus: "Blocked", eventDate: "2026-11-16", quantityReserved: 1 },
            { eventStatus: "Planning", eventDate: "2026-11-17", quantityReserved: 5 },
            { eventStatus: "Cancelled", eventDate: "2026-11-15", quantityReserved: 4 },
          ],
        }),
      ]),
    ]);

    expect(result?.lines[0]?.available).toBe(4);
  });

  it("AC4: gives no number for an event with no date yet", async () => {
    const result = await view([event([stock()], null)]);

    expect(result?.lines[0]?.available).toBeNull();
  });
});
