import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  COORDINATOR,
  OTHER_COORDINATOR,
  PROJECTOR,
  REVIEWER,
  SPEAKER,
  seedEvent,
  seededEquipment,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import {
  DuplicateEquipmentRequirementError,
  EquipmentItemNotInCatalogueError,
  EquipmentRequirementsLockedError,
  EventNotFoundError,
  InvalidEquipmentQuantityError,
} from "@/core/domain/errors";

import { RecordEquipmentRequirementUseCase } from "./record-equipment-requirement";

function record(deps = buildEquipmentDeps()) {
  return {
    ...deps,
    useCase: new RecordEquipmentRequirementUseCase(deps),
  };
}

const speaker = {
  eventId: "event-1",
  userAccountId: COORDINATOR,
  equipmentItemId: SPEAKER,
  quantityRequested: 2,
  technicalRequirements: "Stage left",
};

describe("RecordEquipmentRequirementUseCase (SPM-184)", () => {
  it("opens the event's reservation with its first line", async () => {
    const { useCase, equipment } = record(buildEquipmentDeps([seedEvent()], {}));

    const change = await useCase.execute(speaker);

    expect(change).toEqual({
      action: "recorded",
      event: { id: "event-1", name: "Founders' Gala Dinner", preferredDate: "2026-12-12" },
      reservationId: "reservation-1",
      reviewerUserAccountId: null,
      equipmentItemId: SPEAKER,
      equipmentType: "PA speaker",
      quantityBefore: null,
      quantityAfter: 2,
      changed: true,
      flagged: false,
    });
    expect(equipment.stored("event-1").lines).toEqual([
      expect.objectContaining({ equipmentItemId: SPEAKER, technicalRequirements: "Stage left" }),
    ]);
  });

  it("adds a line for a new type to the event's existing reservation", async () => {
    const { useCase, equipment } = record();

    const change = await useCase.execute(speaker);

    expect(change.reservationId).toBe("reservation-10");
    expect(change.reviewerUserAccountId).toBe(REVIEWER);
    expect(equipment.stored("event-1").lines).toHaveLength(3);
  });

  it("refuses a second line for a type the event already has", async () => {
    const { useCase, equipment } = record();

    await expect(
      useCase.execute({ ...speaker, equipmentItemId: PROJECTOR }),
    ).rejects.toThrow(DuplicateEquipmentRequirementError);
    expect(equipment.stored("event-1")).toEqual(seededEquipment());
  });

  it("refuses a type that is not in the catalogue", async () => {
    const { useCase } = record();

    await expect(
      useCase.execute({ ...speaker, equipmentItemId: "item-hovercraft" }),
    ).rejects.toThrow(EquipmentItemNotInCatalogueError);
  });

  it("refuses a quantity of 0", async () => {
    const { useCase } = record();

    await expect(useCase.execute({ ...speaker, quantityRequested: 0 })).rejects.toThrow(
      InvalidEquipmentQuantityError,
    );
  });

  it("refuses to record a line on a Completed event", async () => {
    const { useCase, equipment } = record(
      buildEquipmentDeps([seedEvent({ status: "Completed" })]),
    );

    await expect(useCase.execute(speaker)).rejects.toThrow(EquipmentRequirementsLockedError);
    expect(equipment.stored("event-1")).toEqual(seededEquipment());
  });

  it.each([
    ["assigned to another coordinator", seedEvent({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })],
    ["not assigned to anyone", seedEvent({ assignedCoordinatorUserAccountId: null })],
    ["that does not exist", seedEvent({ id: "event-2" })],
  ])("answers not-found for an event %s, and stores nothing", async (_label, event) => {
    const { useCase, equipment } = record(buildEquipmentDeps([event]));

    await expect(useCase.execute(speaker)).rejects.toThrow(EventNotFoundError);
    expect(equipment.stored("event-1")).toEqual(seededEquipment());
  });
});
