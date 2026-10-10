import { describe, expect, it } from "vitest";

import { equipmentItemId } from "@/core/domain/equipment-item";
import { InvalidOutOfServiceCountError } from "@/core/domain/errors";

import { toEquipmentCatalogueError, toEquipmentItem } from "./equipment-catalogue-mapper";

describe("equipment catalogue mapper (SPM-17)", () => {
  it("AC5: maps a catalogue row to the item coordinators also pick from", () => {
    expect(
      toEquipmentItem({
        equipment_item_id: 7,
        type: "Laser projector",
        description: "6000-lumen laser projector.",
        quantity: 10,
        physical_location: "Store room C",
        out_of_service: 2,
      }),
    ).toEqual({
      id: "7",
      type: "Laser projector",
      description: "6000-lumen laser projector.",
      quantity: 10,
      location: "Store room C",
      outOfService: 2,
    });
  });

  it("AC2: reads CS042 as an out-of-service count the store refused", () => {
    const error = toEquipmentCatalogueError({ code: "CS042" }, { id: equipmentItemId("7"), quantity: 4 });

    expect(error).toBeInstanceOf(InvalidOutOfServiceCountError);
    expect(error?.message).toContain("(4)");
  });
});
