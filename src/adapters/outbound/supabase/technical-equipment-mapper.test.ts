import { describe, expect, it } from "vitest";

import {
  toEventEquipmentStock,
  toEventWithEquipment,
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
        },
        {
          equipmentItemId: "2",
          quantityRequested: 4,
          technicalRequirements: null,
          quantityReserved: 0,
          state: "Requested",
          reviewBaseline: null,
          removalRequested: false,
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
        otherHolds: [
          { eventStatus: "Confirmed", eventDate: "2026-11-14", quantityReserved: 3 },
          { eventStatus: "Cancelled", eventDate: null, quantityReserved: 1 },
        ],
      },
    ]);
  });
});
