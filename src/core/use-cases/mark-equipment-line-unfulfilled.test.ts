import { describe, expect, it } from "vitest";

import { InMemoryTechnicalEquipmentRepository } from "@/adapters/outbound/in-memory/in-memory-technical-equipment-repository";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import {
  EquipmentAvailableToReserveError,
  EventDateRequiredForEquipmentError,
  UnfulfilledCommentRequiredError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
import type { EventEquipmentStock } from "@/core/ports/outbound/technical-equipment-repository";

import { ListEquipmentQueueUseCase } from "./list-equipment-queue";
import { MarkEquipmentLineUnfulfilledUseCase } from "./mark-equipment-line-unfulfilled";

const SUPPORT = "support-1";

function newLine(item: string, quantityRequested: number): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId(item),
    quantityRequested,
    technicalRequirements: null,
    quantityReserved: 0,
    state: "Requested",
    reviewBaseline: null,
    removalRequested: false,
    decision: null,
  };
}

/** Event A, with a projector line for 5 of the 3 owned and a lectern line for 1 of the 3 owned. */
function setup(preferredDate: string | null = "2026-11-15") {
  const seed: EventEquipmentStock = {
    event: { id: eventId("A"), name: "Event A", status: "Planning", preferredDate },
    lines: [
      {
        line: newLine("item-projector", 5),
        equipmentType: "Projector",
        owned: 3,
        outOfService: 0,
        otherHolds: [],
        decidedByName: null,
      },
      { line: newLine("item-lectern", 1), equipmentType: "Lectern", owned: 3, outOfService: 0, otherHolds: [], decidedByName: null },
    ],
  };
  const equipment = new InMemoryTechnicalEquipmentRepository([seed]);
  const mark = (item: string, comment = "only 3 available") =>
    new MarkEquipmentLineUnfulfilledUseCase({ equipment }).execute({
      eventId: "A",
      equipmentItemId: item,
      userAccountId: SUPPORT,
      comment,
    });
  const stored = async () => (await equipment.eventEquipment(userAccountId(SUPPORT), eventId("A")))?.lines ?? [];
  return { equipment, mark, stored };
}

describe("MarkEquipmentLineUnfulfilledUseCase (SPM-274)", () => {
  it("AC3: marks the line unfulfilled with the comment and who marked it, reserving nothing", async () => {
    const { mark, stored } = setup();

    expect(await mark("item-projector")).toEqual({
      eventId: "A",
      equipmentItemId: "item-projector",
      equipmentType: "Projector",
      state: "Unfulfilled",
      quantityReserved: 0,
    });
    expect((await stored())[0]?.line).toMatchObject({
      state: "Unfulfilled",
      quantityReserved: 0,
      decision: { by: SUPPORT, comment: "only 3 available" },
    });
  });

  it("AC3: leaves the event's other lines as they were", async () => {
    const { mark, stored } = setup();

    await mark("item-projector");

    expect((await stored())[1]?.line).toEqual(newLine("item-lectern", 1));
  });

  it("AC3: the unfulfilled line no longer counts as needing attention", async () => {
    const { equipment, mark } = setup();
    const needsReview = () =>
      new ListEquipmentQueueUseCase({ equipment }).execute({ userAccountId: SUPPORT, queue: "needsReview" });

    await mark("item-projector");
    expect((await needsReview()).events[0]?.linesNeedingAttention).toBe(1);
  });

  it("AC3: refuses while enough are free to reserve the line, storing nothing", async () => {
    const { mark, stored } = setup();

    await expect(mark("item-lectern", "none spare")).rejects.toThrow(EquipmentAvailableToReserveError);
    expect((await stored())[1]?.line.state).toBe("Requested");
  });

  it("AC3: refuses without a comment", async () => {
    const { mark, stored } = setup();

    await expect(mark("item-projector", "  ")).rejects.toThrow(UnfulfilledCommentRequiredError);
    expect((await stored())[0]?.line.state).toBe("Requested");
  });

  it("AC2: refuses an event with no date", async () => {
    const { mark } = setup(null);

    await expect(mark("item-projector")).rejects.toThrow(EventDateRequiredForEquipmentError);
  });
});
