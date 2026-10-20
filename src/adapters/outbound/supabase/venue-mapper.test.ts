import { describe, expect, it } from "vitest";

import { toVenue, toVenueArgument, type VenueRow } from "./venue-mapper";

describe("venue mapper (SPM-331)", () => {
  const row: VenueRow = {
    venue_id: 7,
    location: "Marina Bay Hall",
    facilities: "Wi-Fi",
    accessibility: null,
    opening_hours: [{ start: "07:00", end: "12:00" }, { start: "19:00", end: "24:00" }],
    capacity: 300,
    booking_horizon_days: 180,
    layouts: [{ name: "Theatre", capacity: 200 }],
  };

  it("maps a stored venue with its opening hours", () => {
    expect(toVenue(row)).toEqual({
      id: "7",
      location: "Marina Bay Hall",
      facilities: "Wi-Fi",
      accessibility: null,
      openingHours: [{ start: "07:00", end: "12:00" }, { start: "19:00", end: "24:00" }],
      capacity: 300,
      bookingHorizonDays: 180,
      layouts: [{ name: "Theatre", capacity: 200 }],
    });
  });

  it("maps a venue with no opening hours on record to none", () => {
    expect(toVenue({ ...row, opening_hours: [] }).openingHours).toEqual([]);
  });

  it("writes a venue in the shape the database function reads", () => {
    expect(
      toVenueArgument({
        location: "Hall",
        facilities: null,
        accessibility: "Ramp",
        openingHours: [{ start: "13:00", end: "18:00" }],
        capacity: null,
        bookingHorizonDays: 90,
        layouts: [{ name: "Banquet", capacity: 80 }],
      }),
    ).toEqual({
      location: "Hall",
      facilities: null,
      accessibility: "Ramp",
      opening_hours: [{ start: "13:00", end: "18:00" }],
      capacity: null,
      booking_horizon_days: 90,
      layouts: [{ name: "Banquet", capacity: 80 }],
    });
  });
});
