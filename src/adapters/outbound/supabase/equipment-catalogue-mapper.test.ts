import { describe, expect, it } from "vitest";

import { equipmentItemId } from "@/core/domain/equipment-item";
import { InvalidOutOfServiceCountError } from "@/core/domain/errors";

import { toEquipmentCatalogueError, toEquipmentItem, toEventReservations } from "./equipment-catalogue-mapper";

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

describe("equipment catalogue mapper (SPM-274)", () => {
  it("AC7: groups every event's reservation by the item reserved", () => {
    const row = { event_name: "Tech Summit Keynote", status: "Planning" as const, preferred_date: "2026-11-15" };

    const byItem = toEventReservations([
      { ...row, equipment_item_id: 1, event_id: 7, quantity_reserved: 4 },
      { ...row, equipment_item_id: 2, event_id: 7, quantity_reserved: 2 },
      { ...row, equipment_item_id: 1, event_id: 8, quantity_reserved: 3, preferred_date: null },
    ]);

    expect(byItem.get(equipmentItemId("1"))).toEqual([
      { eventId: "7", eventName: "Tech Summit Keynote", eventStatus: "Planning", eventDate: "2026-11-15", quantityReserved: 4 },
      { eventId: "8", eventName: "Tech Summit Keynote", eventStatus: "Planning", eventDate: null, quantityReserved: 3 },
    ]);
    expect(byItem.get(equipmentItemId("2"))).toHaveLength(1);
  });
});
