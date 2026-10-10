import { describe, expect, it } from "vitest";

import { toVenue, toVenueArgument, type VenueRow } from "./venue-mapper";

describe("venue mapper (SPM-146)", () => {
  const row: VenueRow = {
    venue_id: 7,
    location: "Marina Bay Hall",
    facilities: "Wi-Fi",
    accessibility: null,
    slots: ["AM", "Night"],
    capacity: 300,
    booking_horizon_days: 180,
    layouts: [{ name: "Theatre", capacity: 200 }],
  };

  it("maps a stored venue with the slots it offers", () => {
    expect(toVenue(row)).toEqual({
      id: "7",
      location: "Marina Bay Hall",
      facilities: "Wi-Fi",
      accessibility: null,
      slots: ["AM", "Night"],
      capacity: 300,
      bookingHorizonDays: 180,
      layouts: [{ name: "Theatre", capacity: 200 }],
    });
  });

  it("maps a venue with no slots on record to none", () => {
    expect(toVenue({ ...row, slots: [] }).slots).toEqual([]);
  });

  it("writes a venue in the shape the database function reads", () => {
    expect(
      toVenueArgument({
        location: "Hall",
        facilities: null,
        accessibility: "Ramp",
        slots: ["PM"],
        capacity: null,
        bookingHorizonDays: 90,
        layouts: [{ name: "Banquet", capacity: 80 }],
      }),
    ).toEqual({
      location: "Hall",
      facilities: null,
      accessibility: "Ramp",
      slots: ["PM"],
      capacity: null,
      booking_horizon_days: 90,
      layouts: [{ name: "Banquet", capacity: 80 }],
    });
  });
});
