import { describe, expect, it } from "vitest";

import {
  equipmentItemId,
  newEquipmentItem,
  unitsInService,
  updateEquipmentStock,
  type EquipmentItem,
} from "./equipment-item";
import {
  EquipmentLocationRequiredError,
  EquipmentTypeRequiredError,
  InvalidEquipmentItemIdError,
  InvalidEquipmentQuantityError,
  InvalidOutOfServiceCountError,
} from "./errors";

const PROJECTOR = {
  type: "Projector (4K)",
  description: "Ceiling-mount capable",
  quantity: 6,
  location: "Store A",
};

function stored(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return { id: equipmentItemId("item-1"), ...PROJECTOR, outOfService: 0, ...overrides };
}

describe("newEquipmentItem (SPM-40)", () => {
  it("AC1: builds a record from type, description, quantity and location", () => {
    expect(newEquipmentItem(PROJECTOR)).toEqual({ ...PROJECTOR, outOfService: 0 });
  });

  it("trims text and treats a blank description as none", () => {
    expect(
      newEquipmentItem({ type: "  Lectern ", description: "   ", quantity: 2, location: " Bay 1 " }),
    ).toEqual({ type: "Lectern", description: null, quantity: 2, location: "Bay 1", outOfService: 0 });
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
    const updated = updateEquipmentStock(stored(), { quantity: 4, location: "Store B", outOfService: 0 });

    expect(updated).toEqual(stored({ quantity: 4, location: "Store B" }));
  });

  it("AC2: refuses a negative quantity", () => {
    expect(() => updateEquipmentStock(stored(), { quantity: -1, location: "Store A", outOfService: 0 })).toThrow(
      InvalidEquipmentQuantityError,
    );
  });

  it("AC2: refuses a blank location", () => {
    expect(() => updateEquipmentStock(stored(), { quantity: 1, location: " ", outOfService: 0 })).toThrow(
      EquipmentLocationRequiredError,
    );
  });

  it("does not mutate the record it was given", () => {
    const original = stored();
    updateEquipmentStock(original, { quantity: 0, location: "Store C", outOfService: 0 });

    expect(original).toEqual(stored());
  });
});

describe("equipmentItemId (SPM-40)", () => {
  it("refuses a blank id", () => {
    expect(() => equipmentItemId("  ")).toThrow(InvalidEquipmentItemIdError);
  });
});

describe("updateEquipmentStock (SPM-17)", () => {
  const change = (quantity: number, outOfService: number) => ({ quantity, location: "Store A", outOfService });

  it("AC1: sets how many units are out of service and keeps the rest of the record", () => {
    expect(updateEquipmentStock(stored(), change(6, 2))).toEqual(stored({ outOfService: 2 }));
  });

  it("AC1: setting it back to 0 returns every unit to service", () => {
    expect(updateEquipmentStock(stored({ outOfService: 3 }), change(6, 0)).outOfService).toBe(0);
  });

  it("AC2: accepts exactly the number owned", () => {
    expect(updateEquipmentStock(stored(), change(6, 6)).outOfService).toBe(6);
  });

  it("AC2: refuses one more than the number owned", () => {
    expect(() => updateEquipmentStock(stored(), change(6, 7))).toThrow(InvalidOutOfServiceCountError);
  });

  it.each([-1, 1.5, Number.NaN])("AC2: refuses the impossible count %s", (outOfService) => {
    expect(() => updateEquipmentStock(stored(), change(6, outOfService))).toThrow(InvalidOutOfServiceCountError);
  });

  it("AC2: refuses lowering owned below the current out-of-service count", () => {
    expect(() => updateEquipmentStock(stored({ outOfService: 3 }), change(2, 3))).toThrow(
      InvalidOutOfServiceCountError,
    );
  });

  it("AC2: allows lowering owned to exactly the out-of-service count", () => {
    expect(updateEquipmentStock(stored({ outOfService: 3 }), change(3, 3))).toEqual(
      stored({ quantity: 3, outOfService: 3 }),
    );
  });
});

describe("unitsInService (SPM-17)", () => {
  it("AC3: counts the units owned less those out of service", () => {
    expect(unitsInService({ quantity: 6, outOfService: 2 })).toBe(4);
    expect(unitsInService({ quantity: 6, outOfService: 6 })).toBe(0);
  });
});
