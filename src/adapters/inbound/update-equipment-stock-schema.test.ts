import { describe, expect, it } from "vitest";

import { updateEquipmentStockSchema } from "./update-equipment-stock-schema";

describe("updateEquipmentStockSchema (SPM-40)", () => {
  it("AC2: accepts an id, quantity and location, turning the quantity into a number", () => {
    const parsed = updateEquipmentStockSchema.safeParse({
      equipmentItemId: "equipment-1",
      quantity: "4",
      location: "Store B",
      outOfService: "0",
    });

    expect(parsed.success && parsed.data).toEqual({
      equipmentItemId: "equipment-1",
      quantity: 4,
      location: "Store B",
      outOfService: 0,
    });
  });

  it("rejects a missing id", () => {
    const parsed = updateEquipmentStockSchema.safeParse({
      equipmentItemId: " ",
      quantity: "4",
      location: "Store B",
      outOfService: "0",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a negative quantity", () => {
    const parsed = updateEquipmentStockSchema.safeParse({
      equipmentItemId: "equipment-1",
      quantity: "-2",
      location: "Store B",
      outOfService: "0",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a blank location", () => {
    const parsed = updateEquipmentStockSchema.safeParse({
      equipmentItemId: "equipment-1",
      quantity: "4",
      location: "",
      outOfService: "0",
    });

    expect(parsed.success).toBe(false);
  });
});
