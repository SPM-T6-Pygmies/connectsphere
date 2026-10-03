import { describe, expect, it } from "vitest";

import { NotTechnicalSupportStaffError } from "@/core/domain/errors";

import {
  toEquipmentRecheckError,
  toUnderReviewEquipmentLine,
  type UnderReviewEquipmentRow,
} from "./equipment-recheck-mapper";

const projector: UnderReviewEquipmentRow = {
  event_id: 7,
  event_name: "Founders' Gala Dinner",
  preferred_date: "2026-12-12",
  equipment_item_id: 1,
  equipment_type: "Projector",
  quantity_requested: 3,
  quantity_reserved: 2,
  technical_requirements: "HDMI input",
  line_state: "Under review",
  removal_requested: false,
};

describe("equipment re-check mapper (SPM-187)", () => {
  it("AC15: maps a row under review to its event, type and line", () => {
    expect(toUnderReviewEquipmentLine(projector)).toEqual({
      event: { id: "7", name: "Founders' Gala Dinner", preferredDate: "2026-12-12" },
      equipmentType: "Projector",
      line: {
        equipmentItemId: "1",
        quantityRequested: 3,
        technicalRequirements: "HDMI input",
        quantityReserved: 2,
        state: "Under review",
        removalRequested: false,
      },
    });
  });

  it("AC15: maps a line whose removal was requested", () => {
    expect(toUnderReviewEquipmentLine({ ...projector, removal_requested: true }).line.removalRequested).toBe(true);
  });

  it("AC15: maps an event with no date and a line with no notes", () => {
    const mapped = toUnderReviewEquipmentLine({ ...projector, preferred_date: null, technical_requirements: null });

    expect(mapped.event.preferredDate).toBeNull();
    expect(mapped.line.technicalRequirements).toBeNull();
  });

  it("AC16: maps SQLSTATE CS040 to the not-Technical-Support error", () => {
    expect(toEquipmentRecheckError({ code: "CS040" })).toBeInstanceOf(NotTechnicalSupportStaffError);
  });

  it("leaves any other failure to the caller", () => {
    expect(toEquipmentRecheckError({ code: "XX000" })).toBeNull();
    expect(toEquipmentRecheckError({})).toBeNull();
  });
});
