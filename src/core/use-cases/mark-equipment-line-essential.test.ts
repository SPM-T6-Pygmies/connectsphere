import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  COORDINATOR,
  MICROPHONE,
  OTHER_COORDINATOR,
  PROJECTOR,
  seedEvent,
  SPEAKER,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import {
  EquipmentRequirementNotFoundError,
  EquipmentRequirementsLockedError,
  EventNotFoundError,
} from "@/core/domain/errors";

import { MarkEquipmentLineEssentialUseCase } from "./mark-equipment-line-essential";

function mark(deps = buildEquipmentDeps()) {
  return { ...deps, useCase: new MarkEquipmentLineEssentialUseCase(deps) };
}

const base = { eventId: "event-1", userAccountId: COORDINATOR, equipmentItemId: PROJECTOR, essential: true };

describe("MarkEquipmentLineEssentialUseCase (SPM-109)", () => {
  it("AC1: stores the line as essential, and as not essential again", async () => {
    const { useCase, equipment } = mark();

    await useCase.execute(base);
    expect(equipment.stored("event-1").lines[0]).toMatchObject({ equipmentItemId: PROJECTOR, essential: true });

    await useCase.execute({ ...base, essential: false });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({ equipmentItemId: PROJECTOR, essential: false });
  });

  it("AC1: leaves the rest of a reserved line as Technical Support had it", async () => {
    const { useCase, equipment } = mark();
    const before = equipment.stored("event-1").lines[0];

    await useCase.execute(base);

    expect(equipment.stored("event-1").lines[0]).toEqual({ ...before, essential: true });
  });

  it("AC3: is judged per line, so the event's other lines stay as they were", async () => {
    const { useCase, equipment } = mark();

    await useCase.execute(base);

    expect(equipment.stored("event-1").lines.find((line) => line.equipmentItemId === MICROPHONE)?.essential).toBe(
      false,
    );
  });

  it("AC2: refuses a coordinator not assigned to the event, as if it did not exist", async () => {
    const { useCase, equipment } = mark();

    await expect(useCase.execute({ ...base, userAccountId: OTHER_COORDINATOR })).rejects.toThrow(EventNotFoundError);
    expect(equipment.stored("event-1").lines[0].essential).toBe(false);
  });

  it("refuses a line the event does not have", async () => {
    const { useCase } = mark();

    await expect(useCase.execute({ ...base, equipmentItemId: SPEAKER })).rejects.toThrow(
      EquipmentRequirementNotFoundError,
    );
  });

  it.each(["Completed", "Cancelled"] as const)("refuses to mark a line on a %s event", async (status) => {
    const { useCase, equipment } = mark(buildEquipmentDeps([seedEvent({ status })]));

    await expect(useCase.execute(base)).rejects.toThrow(EquipmentRequirementsLockedError);
    expect(equipment.stored("event-1").lines[0].essential).toBe(false);
  });
});
