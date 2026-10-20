import { describe, expect, it } from "vitest";

import { eventId } from "@/core/domain/event";

import { toReadinessFacts, type EventReadinessRow } from "./supabase-event-readiness-repository";

const row: EventReadinessRow = {
  essential_types: [],
  confirmed_venue_location: null,
  programme_agenda: null,
  registration_enabled: false,
  registration_open_date: null,
  registration_close_date: null,
  essential_equipment: [
    { equipment_type: "Projector", line_state: "Reserved", quantity_requested: 2, quantity_reserved: 2 },
  ],
};

describe("toReadinessFacts (SPM-318)", () => {
  it("AC1: maps each essential equipment line", () => {
    expect(toReadinessFacts(eventId("3"), row).essentialEquipment).toEqual([
      { equipmentType: "Projector", state: "Reserved", quantityRequested: 2, quantityReserved: 2 },
    ]);
  });

  it("AC2: maps no essential lines to none", () => {
    expect(toReadinessFacts(eventId("3"), { ...row, essential_equipment: null }).essentialEquipment).toEqual([]);
  });
});
