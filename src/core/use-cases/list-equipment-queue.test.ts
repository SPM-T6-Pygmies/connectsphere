import { describe, expect, it } from "vitest";

import { InMemoryTechnicalEquipmentRepository } from "@/adapters/outbound/in-memory/in-memory-technical-equipment-repository";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import type { EquipmentQueue } from "@/core/domain/equipment-review";
import { eventId } from "@/core/domain/event";
import type { EventEquipmentStock } from "@/core/ports/outbound/technical-equipment-repository";

import { ListEquipmentQueueUseCase } from "./list-equipment-queue";

const SUPPORT = "support-1";

function reserved(item = "item-projector"): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId(item),
    quantityRequested: 2,
    technicalRequirements: null,
    quantityReserved: 2,
    state: "Reserved",
    reviewBaseline: null,
    removalRequested: false,
  };
}

function requested(item = "item-microphone"): EquipmentRequirement {
  return { ...reserved(item), quantityReserved: 0, state: "Requested" };
}

function changed(item = "item-speaker"): EquipmentRequirement {
  return {
    ...reserved(item),
    quantityRequested: 3,
    state: "Under review",
    reviewBaseline: { quantityRequested: 2, technicalRequirements: null },
  };
}

function removalRequested(item = "item-laptop"): EquipmentRequirement {
  return {
    ...reserved(item),
    state: "Under review",
    reviewBaseline: { quantityRequested: 2, technicalRequirements: null },
    removalRequested: true,
  };
}

function entry(
  id: string,
  lines: readonly EquipmentRequirement[],
  status: CoordinatorEventStatus = "Planning",
  preferredDate: string | null = "2026-12-12",
): EventEquipmentStock {
  return {
    event: { id: eventId(id), name: `Event ${id}`, status, preferredDate },
    lines: lines.map((line) => ({ line, equipmentType: String(line.equipmentItemId), owned: 10, otherHolds: [] })),
  };
}

function list(seed: readonly EventEquipmentStock[], queue: EquipmentQueue = "needsReview") {
  return new ListEquipmentQueueUseCase({ equipment: new InMemoryTechnicalEquipmentRepository(seed) }).execute({
    userAccountId: SUPPORT,
    queue,
  });
}

describe("ListEquipmentQueueUseCase (SPM-273)", () => {
  it("AC1: shows each event's name, date and how many lines need attention", async () => {
    const result = await list([entry("1", [reserved(), requested(), changed(), removalRequested()])]);

    expect(result.events).toEqual([
      {
        eventId: "1",
        eventName: "Event 1",
        preferredDate: "2026-12-12",
        status: "Planning",
        lineCount: 4,
        linesNeedingAttention: 3,
      },
    ]);
  });

  it("AC1: lists active events with a new, changed or removal-requested line, and leaves out the rest", async () => {
    const result = await list([
      entry("new", [requested()], "Planning"),
      entry("changed", [changed()], "Blocked"),
      entry("removal", [removalRequested()], "Confirmed"),
      entry("all-reserved", [reserved()], "Planning"),
      entry("completed", [requested()], "Completed"),
      entry("cancelled", [changed()], "Cancelled"),
      entry("no-lines", [], "Planning"),
    ]);

    expect(result.events.map((event) => event.eventId)).toEqual(["new", "changed", "removal"]);
  });

  it("AC1: keeps the store's order, soonest first and undated last", async () => {
    const result = await list([
      entry("soon", [requested()], "Planning", "2026-11-01"),
      entry("later", [requested()], "Planning", "2027-02-01"),
      entry("undated", [requested()], "Planning", null),
    ]);

    expect(result.events.map((event) => [event.eventId, event.preferredDate])).toEqual([
      ["soon", "2026-11-01"],
      ["later", "2027-02-01"],
      ["undated", null],
    ]);
  });

  it("AC2: lists every event the store holds, whatever equipment type it needs", async () => {
    const result = await list([
      entry("projectors", [requested("item-projector")]),
      entry("microphones", [requested("item-microphone")]),
      entry("speakers", [changed("item-speaker")]),
    ]);

    expect(result.events).toHaveLength(3);
  });

  it("AC5: gives an empty list when nothing needs attention", async () => {
    const result = await list([entry("1", [reserved()]), entry("2", [requested()], "Completed")]);

    expect(result.events).toEqual([]);
  });

  it("the Reviewed list holds active events whose lines are all reserved", async () => {
    const result = await list(
      [
        entry("all-reserved", [reserved(), reserved("item-microphone")], "Confirmed"),
        entry("needs-review", [reserved(), requested()], "Planning"),
        entry("completed", [reserved()], "Completed"),
      ],
      "reviewed",
    );

    expect(result.events.map((event) => [event.eventId, event.linesNeedingAttention])).toEqual([["all-reserved", 0]]);
  });

  it("the Archive list holds Completed and Cancelled events with equipment lines", async () => {
    const result = await list(
      [
        entry("completed", [reserved()], "Completed"),
        entry("cancelled", [requested()], "Cancelled"),
        entry("active", [reserved()], "Planning"),
        entry("cancelled-no-lines", [], "Cancelled"),
      ],
      "archive",
    );

    expect(result.events.map((event) => event.eventId)).toEqual(["completed", "cancelled"]);
  });
});
