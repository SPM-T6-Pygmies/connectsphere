import { describe, expect, it } from "vitest";

import {
  equipmentItemId,
  newEquipmentItem,
  updateEquipmentStock,
  type EquipmentItem,
} from "./equipment-item";
import {
  EquipmentLocationRequiredError,
  EquipmentTypeRequiredError,
  InvalidEquipmentItemIdError,
  InvalidEquipmentQuantityError,
} from "./errors";

const PROJECTOR = {
  type: "Projector (4K)",
  description: "Ceiling-mount capable",
  quantity: 6,
  location: "Store A",
};

function stored(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return { id: equipmentItemId("item-1"), ...PROJECTOR, ...overrides };
}

describe("newEquipmentItem (SPM-40)", () => {
  it("AC1: builds a record from type, description, quantity and location", () => {
    expect(newEquipmentItem(PROJECTOR)).toEqual(PROJECTOR);
  });

  it("trims text and treats a blank description as none", () => {
    expect(
      newEquipmentItem({ type: "  Lectern ", description: "   ", quantity: 2, location: " Bay 1 " }),
    ).toEqual({ type: "Lectern", description: null, quantity: 2, location: "Bay 1" });
  });

  it("AC1: refuses a record with no type", () => {
    expect(() => newEquipmentItem({ ...PROJECTOR, type: "   " })).toThrow(
      EquipmentTypeRequiredError,
    );
  });

  it("AC1: refuses a record with no physical location", () => {
    expect(() => newEquipmentItem({ ...PROJECTOR, location: "" })).toThrow(
      EquipmentLocationRequiredError,
    );
  });

  it("accepts a quantity of exactly zero (the boundary)", () => {
    expect(newEquipmentItem({ ...PROJECTOR, quantity: 0 }).quantity).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses the impossible quantity %s",
    (quantity) => {
      expect(() => newEquipmentItem({ ...PROJECTOR, quantity })).toThrow(
        InvalidEquipmentQuantityError,
      );
    },
  );
});

describe("updateEquipmentStock (SPM-40)", () => {
  it("AC2: changes the quantity and location and leaves the rest alone", () => {
    const updated = updateEquipmentStock(stored(), { quantity: 4, location: "Store B" });

    expect(updated).toEqual(stored({ quantity: 4, location: "Store B" }));
  });

  it("AC2: refuses a negative quantity", () => {
    expect(() => updateEquipmentStock(stored(), { quantity: -1, location: "Store A" })).toThrow(
      InvalidEquipmentQuantityError,
    );
  });

  it("AC2: refuses a blank location", () => {
    expect(() => updateEquipmentStock(stored(), { quantity: 1, location: " " })).toThrow(
      EquipmentLocationRequiredError,
    );
  });

  it("does not mutate the record it was given", () => {
    const original = stored();
    updateEquipmentStock(original, { quantity: 0, location: "Store C" });

    expect(original).toEqual(stored());
  });
});

describe("equipmentItemId (SPM-40)", () => {
  it("refuses a blank id", () => {
    expect(() => equipmentItemId("  ")).toThrow(InvalidEquipmentItemIdError);
  });
});
