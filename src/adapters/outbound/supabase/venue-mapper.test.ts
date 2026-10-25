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
    setup_minutes: 30,
    turnaround_minutes: 45,
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
      setupMinutes: 30,
      turnaroundMinutes: 45,
      layouts: [{ name: "Theatre", capacity: 200 }],
    });
  });

  it("maps a venue whose setup and turnaround are not defined to null, not 0 (SPM-23)", () => {
    expect(toVenue({ ...row, setup_minutes: null, turnaround_minutes: null })).toMatchObject({
      setupMinutes: null,
      turnaroundMinutes: null,
    });
  });

  it("maps a venue defined as 0 and 0 to 0, which is defined (SPM-23)", () => {
    expect(toVenue({ ...row, setup_minutes: 0, turnaround_minutes: 0 })).toMatchObject({
      setupMinutes: 0,
      turnaroundMinutes: 0,
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
        setupMinutes: 30,
        turnaroundMinutes: 45,
        layouts: [{ name: "Banquet", capacity: 80 }],
      }),
    ).toEqual({
      location: "Hall",
      facilities: null,
      accessibility: "Ramp",
      opening_hours: [{ start: "13:00", end: "18:00" }],
      capacity: null,
      booking_horizon_days: 90,
      setup_minutes: 30,
      turnaround_minutes: 45,
      layouts: [{ name: "Banquet", capacity: 80 }],
    });
  });

  it("writes an undefined pair as nulls, so the database keeps it undefined (SPM-23)", () => {
    const argument = toVenueArgument({
      location: "Hall",
      facilities: null,
      accessibility: null,
      openingHours: [],
      capacity: null,
      bookingHorizonDays: null,
      layouts: [],
    });

    expect(argument).toMatchObject({ setup_minutes: null, turnaround_minutes: null });
  });
});
