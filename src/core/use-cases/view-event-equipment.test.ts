import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  CATALOGUE,
  COORDINATOR,
  line,
  MICROPHONE,
  OTHER_COORDINATOR,
  PROJECTOR,
  REVIEWER,
  seedEvent,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";

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
          unfulfilled: false,
          decision: null,
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
          unfulfilled: false,
          decision: null,
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

describe("ViewEventEquipmentUseCase (SPM-274)", () => {
  function viewLine(seeded: EquipmentRequirement) {
    const deps = buildEquipmentDeps([seedEvent()], {
      "event-1": {
        reservation: { id: "reservation-10", reviewerUserAccountId: REVIEWER },
        lines: [seeded],
        deciderNames: { [REVIEWER]: "Test Support Staff" },
      },
    });
    return view(deps)
      .execute({ eventId: "event-1", userAccountId: COORDINATOR })
      .then((result) => result?.lines[0]);
  }

  it("AC1: shows a reserved line as reserved, with the name of who reserved it", async () => {
    const reserved = line({ quantityReserved: 4, decision: { by: REVIEWER, comment: null } });

    expect(await viewLine(reserved)).toMatchObject({
      reserved: true,
      unfulfilled: false,
      decision: { byName: "Test Support Staff", comment: null },
    });
  });

  it("AC3: shows an unfulfilled line as unfulfilled, with the comment and the name of who marked it", async () => {
    const unfulfilled = line({ state: "Unfulfilled", decision: { by: REVIEWER, comment: "only 3 available" } });

    expect(await viewLine(unfulfilled)).toMatchObject({
      reserved: false,
      unfulfilled: true,
      underReview: false,
      decision: { byName: "Test Support Staff", comment: "only 3 available" },
    });
  });

  it("AC4: once the coordinator changes an unfulfilled line, it shows as waiting on Technical Support again", async () => {
    const changed = line({
      state: "Under review",
      reviewBaseline: { quantityRequested: 5, technicalRequirements: null },
      decision: { by: REVIEWER, comment: "only 3 available" },
    });

    expect(await viewLine(changed)).toMatchObject({ unfulfilled: false, underReview: true, reserved: false });
  });
});
