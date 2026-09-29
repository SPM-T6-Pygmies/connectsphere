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
      lines: [
        {
          equipmentItemId: PROJECTOR,
          equipmentType: "Projector",
          quantityRequested: 2,
          quantityReserved: 2,
          technicalRequirements: "HDMI input",
          reserved: true,
          recheckRequired: false,
          removalRequested: false,
        },
        {
          equipmentItemId: MICROPHONE,
          equipmentType: "Wireless microphone",
          quantityRequested: 4,
          quantityReserved: 0,
          technicalRequirements: null,
          reserved: false,
          recheckRequired: false,
          removalRequested: false,
        },
      ],
      catalogue: CATALOGUE,
    });
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
