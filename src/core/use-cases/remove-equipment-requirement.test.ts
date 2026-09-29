import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  COORDINATOR,
  MICROPHONE,
  OTHER_COORDINATOR,
  PROJECTOR,
  SPEAKER,
  seededEquipment,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import { EquipmentRequirementNotFoundError, EventNotFoundError } from "@/core/domain/errors";

import { RemoveEquipmentRequirementUseCase } from "./remove-equipment-requirement";

function remove(deps = buildEquipmentDeps()) {
  return { ...deps, useCase: new RemoveEquipmentRequirementUseCase(deps) };
}

const base = { eventId: "event-1", userAccountId: COORDINATOR };

describe("RemoveEquipmentRequirementUseCase (SPM-184)", () => {
  it("deletes an unreserved line", async () => {
    const { useCase, equipment } = remove();

    const change = await useCase.execute({ ...base, equipmentItemId: MICROPHONE });

    expect(change).toMatchObject({ action: "deleted", quantityBefore: 4, quantityAfter: null, flagged: false });
    expect(equipment.stored("event-1").lines.map((line) => line.equipmentItemId)).toEqual([PROJECTOR]);
  });

  it("keeps a reserved line, marks its removal requested and flags it", async () => {
    const { useCase, equipment } = remove();

    const change = await useCase.execute({ ...base, equipmentItemId: PROJECTOR });

    expect(change).toMatchObject({ action: "removalRequested", quantityAfter: 2, flagged: true });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      quantityReserved: 2,
      removalRequested: true,
      recheckRequired: true,
    });
  });

  it("refuses to remove a type the event has no line for", async () => {
    const { useCase } = remove();

    await expect(useCase.execute({ ...base, equipmentItemId: SPEAKER })).rejects.toThrow(
      EquipmentRequirementNotFoundError,
    );
  });

  it("answers not-found to a coordinator the event is not assigned to, and removes nothing", async () => {
    const { useCase, equipment } = remove();

    await expect(
      useCase.execute({ ...base, userAccountId: OTHER_COORDINATOR, equipmentItemId: MICROPHONE }),
    ).rejects.toThrow(EventNotFoundError);
    expect(equipment.stored("event-1")).toEqual(seededEquipment());
  });
});
