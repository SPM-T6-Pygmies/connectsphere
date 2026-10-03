import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  CATALOGUE,
  COORDINATOR,
  MICROPHONE,
  OTHER_COORDINATOR,
  PROJECTOR,
  seedEvent,
} from "@/adapters/outbound/in-memory/equipment-fixture";

import { ViewEventEquipmentUseCase } from "./view-event-equipment";

function view(deps = buildEquipmentDeps()) {
  return new ViewEventEquipmentUseCase(deps);
}

describe("ViewEventEquipmentUseCase (SPM-184)", () => {
  it("lists the event's lines by type, with the catalogue to add from", async () => {
    const result = await view().execute({ eventId: "event-1", userAccountId: COORDINATOR });

    expect(result).toEqual({
      event: { id: "event-1", name: "Founders' Gala Dinner", status: "Planning" },
      editable: true,
      statedEquipmentNeeds: null,
      lines: [
        {
          equipmentItemId: PROJECTOR,
          equipmentType: "Projector",
          quantityRequested: 2,
          quantityReserved: 2,
          technicalRequirements: "HDMI input",
          reserved: true,
          underReview: false,
          removalRequested: false,
        },
        {
          equipmentItemId: MICROPHONE,
          equipmentType: "Wireless microphone",
          quantityRequested: 4,
          quantityReserved: 0,
          technicalRequirements: null,
          reserved: false,
          underReview: false,
          removalRequested: false,
        },
      ],
      catalogue: CATALOGUE,
    });
  });

  it("AC6 (SPM-186): shows the Organiser's originally stated equipment needs alongside the lines", async () => {
    const stated = "Two projectors and a stage microphone for the keynote.";
    const result = await view(buildEquipmentDeps([seedEvent({ statedEquipmentNeeds: stated })])).execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
    });

    expect(result?.statedEquipmentNeeds).toBe(stated);
    expect(result?.lines).toHaveLength(2);
  });

  it("AC6 (SPM-186): shows no stated needs when the Organiser gave none", async () => {
    const result = await view(buildEquipmentDeps([seedEvent({ statedEquipmentNeeds: null })])).execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
    });

    expect(result?.statedEquipmentNeeds).toBeNull();
  });

  it("marks a Completed event's lines read-only", async () => {
    const result = await view(buildEquipmentDeps([seedEvent({ status: "Completed" })])).execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
    });

    expect(result?.editable).toBe(false);
  });

  it("shows nothing to a coordinator the event is not assigned to", async () => {
    const result = await view().execute({ eventId: "event-1", userAccountId: OTHER_COORDINATOR });

    expect(result).toBeNull();
  });
});
