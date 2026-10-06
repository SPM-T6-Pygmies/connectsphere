import { describe, expect, it, vi } from "vitest";

import {
  buildEquipmentDeps,
  COORDINATOR,
  MICROPHONE,
  OTHER_COORDINATOR,
  PROJECTOR,
  REVIEWER,
  SPEAKER,
  seedEvent,
  seededEquipment,
  watchEquipmentForSafety,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import {
  EquipmentRequirementNotFoundError,
  EquipmentRequirementsLockedError,
  EventNotFoundError,
} from "@/core/domain/errors";

import { EditEquipmentRequirementUseCase } from "./edit-equipment-requirement";

function edit(deps = buildEquipmentDeps()) {
  return { ...deps, useCase: new EditEquipmentRequirementUseCase(deps) };
}

const base = { eventId: "event-1", userAccountId: COORDINATOR };

describe("EditEquipmentRequirementUseCase (SPM-184)", () => {
  it("saves a change to an unreserved line without flagging it", async () => {
    const { useCase, equipment } = edit();

    const change = await useCase.execute({
      ...base,
      equipmentItemId: MICROPHONE,
      quantityRequested: 6,
      technicalRequirements: null,
    });

    expect(change).toMatchObject({ action: "edited", quantityBefore: 4, quantityAfter: 6, changed: true, underReview: false });
    expect(equipment.stored("event-1").lines[1]).toMatchObject({
      quantityRequested: 6,
      state: "Requested",
    });
  });

  it("saves a change to a reserved line, puts it under review and keeps its equipment held", async () => {
    const { useCase, equipment } = edit();

    const change = await useCase.execute({
      ...base,
      equipmentItemId: PROJECTOR,
      quantityRequested: 1,
      technicalRequirements: "HDMI input",
    });

    expect(change).toMatchObject({
      equipmentType: "Projector",
      reservationId: "reservation-10",
      reviewerUserAccountId: REVIEWER,
      quantityBefore: 2,
      quantityAfter: 1,
      changed: true,
      underReview: true,
    });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      quantityRequested: 1,
      quantityReserved: 2,
      state: "Under review",
    });
  });

  it("stores nothing and puts nothing under review for a save that changes nothing", async () => {
    const { useCase, equipment } = edit();
    const update = vi.spyOn(equipment, "update");

    const change = await useCase.execute({
      ...base,
      equipmentItemId: PROJECTOR,
      quantityRequested: 2,
      technicalRequirements: "HDMI input",
    });

    expect(change).toMatchObject({ changed: false, underReview: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to edit a type the event has no line for", async () => {
    const { useCase } = edit();

    await expect(
      useCase.execute({ ...base, equipmentItemId: SPEAKER, quantityRequested: 1, technicalRequirements: null }),
    ).rejects.toThrow(EquipmentRequirementNotFoundError);
  });

  it("refuses to edit a line on a Cancelled event", async () => {
    const { useCase, equipment } = edit(buildEquipmentDeps([seedEvent({ status: "Cancelled" })]));

    await expect(
      useCase.execute({ ...base, equipmentItemId: MICROPHONE, quantityRequested: 6, technicalRequirements: null }),
    ).rejects.toThrow(EquipmentRequirementsLockedError);
    expect(equipment.stored("event-1")).toEqual(seededEquipment());
  });

  it("answers not-found to a coordinator the event is not assigned to, and stores nothing", async () => {
    const { useCase, equipment } = edit();

    await expect(
      useCase.execute({
        ...base,
        userAccountId: OTHER_COORDINATOR,
        equipmentItemId: MICROPHONE,
        quantityRequested: 6,
        technicalRequirements: null,
      }),
    ).rejects.toThrow(EventNotFoundError);
    expect(equipment.stored("event-1")).toEqual(seededEquipment());
  });
});

describe("EditEquipmentRequirementUseCase reverting an edit (SPM-232)", () => {
  const projector = (quantityRequested: number) => ({
    ...base,
    equipmentItemId: PROJECTOR,
    quantityRequested,
    technicalRequirements: "HDMI input",
  });

  it("AC19: puts a line back to Reserved, and says so, when it is edited back to what Technical Support had", async () => {
    const { useCase, equipment } = edit();

    const first = await useCase.execute(projector(1));
    expect(first).toMatchObject({ underReview: true, reviewCleared: false });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({ state: "Under review", quantityRequested: 1 });

    const back = await useCase.execute(projector(2));

    expect(back).toMatchObject({ changed: true, underReview: false, reviewCleared: true, quantityBefore: 1, quantityAfter: 2 });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      quantityRequested: 2,
      quantityReserved: 2,
      state: "Reserved",
      reviewBaseline: null,
    });
  });

  it("AC19: keeps the line under review when the second edit is not the original", async () => {
    const { useCase, equipment } = edit();

    await useCase.execute(projector(1));
    const second = await useCase.execute(projector(3));

    expect(second).toMatchObject({ underReview: true, reviewCleared: false });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      state: "Under review",
      reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
    });
  });
});

describe("EditEquipmentRequirementUseCase telling Safety Officers (SPM-262)", () => {
  /** Only the projector, reserved in full: the event is on the list until an edit puts it under review. */
  function projectorOnly() {
    const deps = buildEquipmentDeps([seedEvent()], {
      "event-1": { ...seededEquipment(), lines: [seededEquipment().lines[0]!] },
    });
    watchEquipmentForSafety(deps);
    return edit(deps);
  }

  const projector = (quantityRequested: number) => ({
    ...base,
    equipmentItemId: PROJECTOR,
    quantityRequested,
    technicalRequirements: "HDMI input",
  });

  it("AC2: editing a line under review back to what was reserved tells every Safety Officer", async () => {
    const { useCase, notifier } = projectorOnly();
    await useCase.execute(projector(3));

    await useCase.execute(projector(2));

    expect(notifier.safetyChecksReady.map((notice) => notice.recipientUserAccountId)).toEqual(["safety-1", "safety-2"]);
  });

  it("AC3: an edit that puts the line under review tells no one", async () => {
    const { useCase, notifier } = projectorOnly();

    await useCase.execute(projector(3));

    expect(notifier.safetyChecksReady).toEqual([]);
  });
});
