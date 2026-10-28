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
  flagged_bookings: [{ booking_id: 812, venue_location: "Main Hall", booked_for: "2026-11-16 13:00 to 18:00" }],
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

describe("toReadinessFacts (SPM-312)", () => {
  it("AC1: maps each flagged booking", () => {
    expect(toReadinessFacts(eventId("3"), row).flaggedBookings).toEqual([
      { bookingId: "812", venueLocation: "Main Hall", bookedFor: "2026-11-16 13:00 to 18:00" },
    ]);
  });

  it("AC2: maps no flagged bookings to none", () => {
    expect(toReadinessFacts(eventId("3"), { ...row, flagged_bookings: null }).flaggedBookings).toEqual([]);
  });
});
