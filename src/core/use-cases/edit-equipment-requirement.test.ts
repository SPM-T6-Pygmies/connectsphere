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
