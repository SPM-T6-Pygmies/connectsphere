import { describe, expect, it } from "vitest";

import {
  DuplicateEquipmentRequirementError,
  EquipmentItemNotInCatalogueError,
  EquipmentRequirementConflictError,
  EquipmentRequirementNotFoundError,
  EquipmentRequirementsLockedError,
  EventNotFoundError,
} from "@/core/domain/errors";

import {
  toCatalogueItem,
  toEquipmentRequirementError,
  toEventEquipment,
  type EventEquipmentRow,
} from "./equipment-requirement-mapper";

const projector: EventEquipmentRow = {
  equipment_reservation_id: 10,
  reviewed_by_user_account_id: 6,
  equipment_item_id: 1,
  quantity_requested: 2,
  quantity_reserved: 2,
  technical_requirements: "HDMI input",
  line_state: "Under review",
  reviewed_quantity_requested: 2,
  reviewed_technical_requirements: "HDMI input",
  removal_requested: false,
};

describe("equipment requirement mapper (SPM-185)", () => {
  it("maps a catalogue row to a catalogue item", () => {
    expect(toCatalogueItem({ equipment_item_id: 3, type: "PA speaker" })).toEqual({
      id: "3",
      type: "PA speaker",
    });
  });

  it("maps an event with no rows to no reservation and no lines", () => {
    expect(toEventEquipment([])).toEqual({ reservation: null, lines: [] });
  });

  it("maps the reservation and each of its lines", () => {
    expect(
      toEventEquipment([
        projector,
        { ...projector, equipment_item_id: 2, quantity_requested: 4, quantity_reserved: 0,
          technical_requirements: null, line_state: "Requested",
          reviewed_quantity_requested: null, reviewed_technical_requirements: null },
      ]),
    ).toEqual({
      reservation: { id: "10", reviewerUserAccountId: "6" },
      lines: [
        {
          equipmentItemId: "1",
          quantityRequested: 2,
          technicalRequirements: "HDMI input",
          quantityReserved: 2,
          state: "Under review",
          reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
          removalRequested: false,
          decision: null,
        },
        {
          equipmentItemId: "2",
          quantityRequested: 4,
          technicalRequirements: null,
          quantityReserved: 0,
          state: "Requested",
          reviewBaseline: null,
          removalRequested: false,
          decision: null,
        },
      ],
    });
  });

  it("maps a reservation whose lines are all gone to the reservation and no lines", () => {
    expect(
      toEventEquipment([
        {
          equipment_reservation_id: 10,
          reviewed_by_user_account_id: null,
          equipment_item_id: null,
          quantity_requested: null,
          quantity_reserved: null,
          technical_requirements: null,
          line_state: null,
          reviewed_quantity_requested: null,
          reviewed_technical_requirements: null,
          removal_requested: null,
        },
      ]),
    ).toEqual({ reservation: { id: "10", reviewerUserAccountId: null }, lines: [] });
  });

  const context = { eventId: "7", equipmentItemId: "1" };

  it.each([
    ["CS030", EventNotFoundError],
    ["CS031", EquipmentRequirementsLockedError],
    ["CS032", EquipmentItemNotInCatalogueError],
    ["CS033", DuplicateEquipmentRequirementError],
    ["CS034", EquipmentRequirementNotFoundError],
    ["CS035", EquipmentRequirementConflictError],
  ] as const)("maps SQLSTATE %s to its domain error", (code, errorClass) => {
    expect(toEquipmentRequirementError({ code }, context)).toBeInstanceOf(errorClass);
  });

  it("names the event's status when its lines are read-only", () => {
    expect(
      (toEquipmentRequirementError({ code: "CS031", details: "Cancelled" }, context) as EquipmentRequirementsLockedError)
        .status,
    ).toBe("Cancelled");
  });

  it("leaves any other failure to the caller", () => {
    expect(toEquipmentRequirementError({ code: "23514" }, context)).toBeNull();
  });
});
