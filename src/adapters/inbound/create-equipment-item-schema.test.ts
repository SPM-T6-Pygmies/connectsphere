import { describe, expect, it } from "vitest";

import { createEquipmentItemSchema } from "./create-equipment-item-schema";

const VALID = {
  type: "Projector (4K)",
  description: "Ceiling-mount capable",
  quantity: "6",
  location: "Store A",
};

describe("createEquipmentItemSchema (SPM-40)", () => {
  it("AC1: accepts type, description, quantity and location, turning the quantity into a number", () => {
    const parsed = createEquipmentItemSchema.safeParse(VALID);

    expect(parsed.success && parsed.data).toEqual({ ...VALID, quantity: 6 });
  });

  it("accepts a blank description -- it is optional", () => {
    expect(createEquipmentItemSchema.safeParse({ ...VALID, description: "" }).success).toBe(true);
  });

  it("accepts a quantity of exactly 0 (the boundary)", () => {
    const parsed = createEquipmentItemSchema.safeParse({ ...VALID, quantity: "0" });

    expect(parsed.success && parsed.data.quantity).toBe(0);
  });

  it.each(["", "  ", "-1", "2.5", "six", "1e3"])("rejects the quantity %j", (quantity) => {
    expect(createEquipmentItemSchema.safeParse({ ...VALID, quantity }).success).toBe(false);
  });

  it("rejects a blank type", () => {
    expect(createEquipmentItemSchema.safeParse({ ...VALID, type: "  " }).success).toBe(false);
  });

  it("rejects a blank location", () => {
    expect(createEquipmentItemSchema.safeParse({ ...VALID, location: "" }).success).toBe(false);
  });
});
