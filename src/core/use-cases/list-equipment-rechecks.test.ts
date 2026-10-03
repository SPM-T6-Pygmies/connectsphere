import { describe, expect, it } from "vitest";

import { InMemoryEquipmentRecheckRepository } from "@/adapters/outbound/in-memory/in-memory-equipment-recheck-repository";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { eventId } from "@/core/domain/event";
import type { UnderReviewEquipmentLine } from "@/core/ports/outbound/equipment-recheck-repository";

import { ListEquipmentRechecksUseCase } from "./list-equipment-rechecks";

const SUPPORT = { userAccountId: "support-1" };

function line(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId("item-projector"),
    quantityRequested: 3,
    technicalRequirements: null,
    quantityReserved: 2,
    state: "Under review",
    reviewBaseline: { quantityRequested: 2, technicalRequirements: null },
    removalRequested: false,
    ...overrides,
  };
}

function underReview(overrides: Partial<UnderReviewEquipmentLine> = {}): UnderReviewEquipmentLine {
  return {
    event: { id: eventId("event-1"), name: "Founders' Gala Dinner", preferredDate: "2026-12-12" },
    equipmentType: "Projector",
    line: line(),
    ...overrides,
  };
}

function list(seed: readonly UnderReviewEquipmentLine[]) {
  return new ListEquipmentRechecksUseCase({ rechecks: new InMemoryEquipmentRecheckRepository(seed) }).execute(SUPPORT);
}

describe("ListEquipmentRechecksUseCase (SPM-187)", () => {
  it("AC15: shows the event, type, quantity requested against reserved, and that the line was changed", async () => {
    const result = await list([underReview()]);

    expect(result.rechecks).toEqual([
      {
        eventId: "event-1",
        eventName: "Founders' Gala Dinner",
        preferredDate: "2026-12-12",
        equipmentItemId: "item-projector",
        equipmentType: "Projector",
        quantityRequested: 3,
        quantityReserved: 2,
        reason: "changed",
      },
    ]);
  });

  it("AC15: shows a line whose removal was requested as removal requested", async () => {
    const result = await list([underReview({ line: line({ removalRequested: true }) })]);

    expect(result.rechecks.map((recheck) => recheck.reason)).toEqual(["removalRequested"]);
  });

  it("AC15: leaves out a line that is not under review", async () => {
    const result = await list([underReview({ line: line({ state: "Reserved" }) })]);

    expect(result.rechecks).toEqual([]);
  });

  it("AC15: lists lines under review from several events and skips the ones that are not", async () => {
    const result = await list([
      underReview(),
      underReview({
        event: { id: eventId("event-2"), name: "Annual Summit", preferredDate: null },
        line: line({ state: "Reserved" }),
      }),
      underReview({
        event: { id: eventId("event-3"), name: "Product Launch", preferredDate: "2027-01-20" },
        equipmentType: "Wireless microphone",
        line: line({ equipmentItemId: equipmentItemId("item-microphone"), removalRequested: true }),
      }),
    ]);

    expect(result.rechecks.map((recheck) => [recheck.eventName, recheck.equipmentType, recheck.reason])).toEqual([
      ["Founders' Gala Dinner", "Projector", "changed"],
      ["Product Launch", "Wireless microphone", "removalRequested"],
    ]);
  });

  it("AC15: shows an empty list when nothing is under review", async () => {
    const result = await list([]);

    expect(result.rechecks).toEqual([]);
  });
});
