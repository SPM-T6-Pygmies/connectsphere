import { describe, expect, it } from "vitest";

import { equipmentLineDecisionSchema, markEquipmentLineUnfulfilledSchema } from "./equipment-line-decision-schema";

describe("equipment line decision schemas (SPM-274)", () => {
  it("AC1: reads the event and line to reserve", () => {
    expect(equipmentLineDecisionSchema.parse({ eventId: " 7 ", equipmentItemId: "3" })).toEqual({
      eventId: "7",
      equipmentItemId: "3",
    });
  });

  it("AC1: refuses a submission that names no line", () => {
    expect(equipmentLineDecisionSchema.safeParse({ eventId: "7", equipmentItemId: " " }).success).toBe(false);
  });

  it("AC3: passes the comment on as typed, for the domain to judge", () => {
    expect(
      markEquipmentLineUnfulfilledSchema.parse({ eventId: "7", equipmentItemId: "3", comment: " only 3 available " }),
    ).toEqual({ eventId: "7", equipmentItemId: "3", comment: " only 3 available " });
  });
});
