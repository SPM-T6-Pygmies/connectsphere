import { describe, expect, it } from "vitest";

import { toVenue, toVenueArgument, type VenueRow } from "./venue-mapper";

describe("venue mapper (SPM-146)", () => {
  const row: VenueRow = {
    venue_id: 7,
    location: "Marina Bay Hall",
    facilities: "Projector",
    accessibility: null,
    operating_hours_start: "08:00:00",
    operating_hours_end: "22:30:00",
    capacity: 300,
    booking_horizon_days: 180,
    layouts: [{ name: "Theatre", capacity: 200 }],
  };

  it("maps a stored venue, with hours read back as HH:MM", () => {
    expect(toVenue(row)).toEqual({
      id: "7",
      location: "Marina Bay Hall",
      facilities: "Projector",
      accessibility: null,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:30",
      capacity: 300,
      bookingHorizonDays: 180,
      layouts: [{ name: "Theatre", capacity: 200 }],
    });
  });

  it("maps a venue with no operating hours to none", () => {
    const venue = toVenue({ ...row, operating_hours_start: null, operating_hours_end: null });

    expect(venue.operatingHoursStart).toBeNull();
    expect(venue.operatingHoursEnd).toBeNull();
  });

  it("writes a venue in the shape the database function reads", () => {
    expect(
      toVenueArgument({
        location: "Hall",
        facilities: null,
        accessibility: "Ramp",
        operatingHoursStart: "09:00",
        operatingHoursEnd: "17:00",
        capacity: null,
        bookingHorizonDays: 90,
        layouts: [{ name: "Banquet", capacity: 80 }],
      }),
    ).toEqual({
      location: "Hall",
      facilities: null,
      accessibility: "Ramp",
      operating_hours_start: "09:00",
      operating_hours_end: "17:00",
      capacity: null,
      booking_horizon_days: 90,
      layouts: [{ name: "Banquet", capacity: 80 }],
    });
  });
});
