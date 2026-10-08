import { describe, expect, it } from "vitest";

import {
  EquipmentLineNotAwaitingDecisionError,
  EquipmentRequirementNotFoundError,
  EventDateRequiredForEquipmentError,
  NotEnoughEquipmentAvailableError,
} from "@/core/domain/errors";

import {
  toEventEquipmentStock,
  toEventWithEquipment,
  toTechnicalEquipmentError,
  type TechnicalEquipmentLineRow,
  type TechnicalEquipmentStockRow,
} from "./technical-equipment-mapper";

const changedProjector: TechnicalEquipmentLineRow = {
  equipment_item_id: 1,
  quantity_requested: 3,
  quantity_reserved: 2,
  technical_requirements: "HDMI input",
  line_state: "Under review",
  reviewed_quantity_requested: 2,
  reviewed_technical_requirements: "HDMI input",
  removal_requested: false,
  decided_by_user_account_id: null,
  decided_by_name: null,
  decision_comment: null,
};

const newMicrophone: TechnicalEquipmentLineRow = {
  equipment_item_id: 2,
  quantity_requested: 4,
  quantity_reserved: 0,
  technical_requirements: null,
  line_state: "Requested",
  reviewed_quantity_requested: null,
  reviewed_technical_requirements: null,
  removal_requested: false,
  decided_by_user_account_id: null,
  decided_by_name: null,
  decision_comment: null,
};

const event = { event_id: 7, event_name: "Founders' Gala Dinner", status: "Planning" as const, preferred_date: "2026-11-15" };

describe("technical equipment mapper (SPM-273)", () => {
  it("AC1: maps an event row to the event and its lines", () => {
    expect(toEventWithEquipment({ ...event, lines: [changedProjector, newMicrophone] })).toEqual({
      event: { id: "7", name: "Founders' Gala Dinner", status: "Planning", preferredDate: "2026-11-15" },
      lines: [
        {
          equipmentItemId: "1",
          quantityRequested: 3,
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

  it("AC1: maps an undated event", () => {
    expect(toEventWithEquipment({ ...event, preferred_date: null, lines: [newMicrophone] }).event.preferredDate).toBeNull();
  });

  it("AC3, AC4: maps a line's type, the units owned and other events' holds", () => {
    const line: TechnicalEquipmentStockRow = {
      ...changedProjector,
      removal_requested: true,
      equipment_type: "Projector",
      owned: 10,
      out_of_service: 0,
      other_holds: [
        { event_status: "Confirmed", preferred_date: "2026-11-14", quantity_reserved: 3 },
        { event_status: "Cancelled", preferred_date: null, quantity_reserved: 1 },
      ],
    };

    const mapped = toEventEquipmentStock({ ...event, lines: [line] });

    expect(mapped.event.id).toBe("7");
    expect(mapped.lines).toEqual([
      {
        line: expect.objectContaining({ equipmentItemId: "1", removalRequested: true }),
        equipmentType: "Projector",
        owned: 10,
        outOfService: 0,
        otherHolds: [
          { eventStatus: "Confirmed", eventDate: "2026-11-14", quantityReserved: 3 },
          { eventStatus: "Cancelled", eventDate: null, quantityReserved: 1 },
        ],
        decidedByName: null,
      },
    ]);
  });
});

describe("technical equipment mapper (SPM-17)", () => {
  it("AC4: maps a line's units out of service", () => {
    const line: TechnicalEquipmentStockRow = {
      ...changedProjector,
      equipment_type: "Projector",
      owned: 10,
      out_of_service: 3,
      other_holds: [],
    };

    expect(toEventEquipmentStock({ ...event, lines: [line] }).lines[0]?.outOfService).toBe(3);
  });
});

describe("technical equipment mapper (SPM-274)", () => {
  const unfulfilled: TechnicalEquipmentStockRow = {
    ...newMicrophone,
    line_state: "Unfulfilled",
    decided_by_user_account_id: 5,
    decided_by_name: "Test Support Staff",
    decision_comment: "only 3 available",
    equipment_type: "Wireless microphone",
    owned: 8,
    out_of_service: 0,
    other_holds: [],
  };

  it("AC3: maps an unfulfilled line's decision, comment and who made it", () => {
    const [mapped] = toEventEquipmentStock({ ...event, lines: [unfulfilled] }).lines;

    expect(mapped?.line.state).toBe("Unfulfilled");
    expect(mapped?.line.decision).toEqual({ by: "5", comment: "only 3 available" });
    expect(mapped?.decidedByName).toBe("Test Support Staff");
  });

  it("AC1: maps a reservation's decision with no comment", () => {
    const reserved = { ...changedProjector, line_state: "Reserved" as const, decided_by_user_account_id: 5 };

    expect(toEventWithEquipment({ ...event, lines: [reserved] }).lines[0]?.decision).toEqual({ by: "5", comment: null });
  });

  const line = { equipmentItemId: "1", quantityRequested: 4 };

  it("AC2: reads CS044 as an event with no date", () => {
    expect(toTechnicalEquipmentError({ code: "CS044" }, line)).toBeInstanceOf(EventDateRequiredForEquipmentError);
  });

  it("AC6: reads CS046 as too few free now, with how many are", () => {
    const error = toTechnicalEquipmentError({ code: "CS046", details: "2" }, line);

    expect(error).toBeInstanceOf(NotEnoughEquipmentAvailableError);
    expect(error).toMatchObject({ available: 2, requested: 4 });
  });

  it("AC6: reads CS045 as a line someone else decided on, or that changed, since it was read", () => {
    expect(toTechnicalEquipmentError({ code: "CS045" }, line)).toBeInstanceOf(EquipmentLineNotAwaitingDecisionError);
  });

  it("AC1: reads CS043 as a line the event does not have", () => {
    expect(toTechnicalEquipmentError({ code: "CS043" }, line)).toBeInstanceOf(EquipmentRequirementNotFoundError);
  });
});
