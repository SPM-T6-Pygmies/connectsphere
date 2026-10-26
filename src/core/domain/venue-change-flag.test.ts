import { describe, expect, it } from "vitest";

import { venueId, type Venue } from "./venue";
import { flagsForVenueChange, type VenueChangeBooking } from "./venue-change-flag";

const NOW = new Date("2026-10-23T10:00:00+08:00");

const before: Venue = {
  id: venueId("5"),
  location: "Main Hall",
  facilities: "Wi-Fi, Catering area",
  accessibility: "Step-free access, Hearing loop",
  openingHours: [{ start: "08:00", end: "22:00" }],
  capacity: 300,
  bookingHorizonDays: 180,
  layouts: [
    { name: "Theatre", capacity: 300 },
    { name: "Banquet", capacity: 150 },
  ],
};

function after(overrides: Partial<Venue>): Venue {
  return { ...before, ...overrides };
}

function banquetSeats(capacity: number): Venue {
  return after({
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Banquet", capacity },
    ],
  });
}

function booking(overrides: Partial<VenueChangeBooking> = {}): VenueChangeBooking {
  return {
    id: "812",
    status: "Confirmed",
    holdExpiresAt: null,
    slots: [{ date: "2026-11-16", slot: "52" }],
    roomLayoutName: "Banquet",
    needs: {
      expectedAttendance: 120,
      preferredLayout: "Banquet",
      accessibilityNeeds: "Step-free access",
      requiredFacilities: "Wi-Fi",
    },
    ...overrides,
  };
}

describe("flagsForVenueChange (SPM-105)", () => {
  it("AC1: flags a booking whose layout's capacity drops below the attendance, naming the layout", () => {
    expect(flagsForVenueChange(before, banquetSeats(80), [booking()], NOW)).toEqual([
      {
        bookingId: "812",
        sourceRef: "capacity:Banquet",
        detail: "Capacity: Banquet seats 80, 40 over",
        startsFailing: true,
      },
    ]);
  });

  it("AC1: flags a booking when the venue drops an accessibility feature or facility the event needs", () => {
    const flags = flagsForVenueChange(
      before,
      after({ accessibility: "Hearing loop", facilities: "Catering area" }),
      [booking()],
      NOW,
    );

    expect(flags).toEqual([
      {
        bookingId: "812",
        sourceRef: "accessibility",
        detail: "Accessibility: Missing: Step-free access",
        startsFailing: true,
      },
      { bookingId: "812", sourceRef: "facilities", detail: "Facilities: Missing: Wi-Fi", startsFailing: true },
    ]);
  });

  it("AC1: flags a booking when the venue stops offering the event's preferred layout", () => {
    const flags = flagsForVenueChange(
      before,
      after({ layouts: [{ name: "Theatre", capacity: 300 }] }),
      [booking({ roomLayoutName: "Theatre" })],
      NOW,
    );

    expect(flags).toEqual([
      { bookingId: "812", sourceRef: "layout:Banquet", detail: "Layout: Doesn't offer Banquet", startsFailing: true },
    ]);
  });

  it("AC2: leaves a booking that still fits, down to capacity exactly equal to the attendance", () => {
    expect(flagsForVenueChange(before, banquetSeats(130), [booking()], NOW)).toEqual([]);
    expect(flagsForVenueChange(before, banquetSeats(120), [booking()], NOW)).toEqual([]);
  });

  it("AC2: flags one seat short of the attendance", () => {
    expect(flagsForVenueChange(before, banquetSeats(119), [booking()], NOW).map((flag) => flag.detail)).toEqual([
      "Capacity: Banquet seats 119, 1 over",
    ]);
  });

  it("AC3: does not flag a check that already failed before the change, for the same reason", () => {
    const lacksVideo = booking({ needs: { ...booking().needs, requiredFacilities: "Video-conferencing" } });

    expect(flagsForVenueChange(before, after({ facilities: "Wi-Fi" }), [lacksVideo], NOW)).toEqual([]);
  });

  it("AC4: flags nothing when only the location, opening hours, horizon or venue-wide capacity change", () => {
    const edited = after({
      location: "Main Hall (East Wing)",
      openingHours: [{ start: "09:00", end: "17:00" }],
      bookingHorizonDays: 30,
      capacity: 310,
    });

    expect(flagsForVenueChange(before, edited, [booking()], NOW)).toEqual([]);
  });

  it("AC5: does not flag a check it cannot judge (Check incomplete)", () => {
    const noAttendance = booking({ needs: { ...booking().needs, expectedAttendance: null } });

    expect(flagsForVenueChange(before, banquetSeats(10), [noAttendance], NOW)).toEqual([]);
  });

  it("AC6: flags a live Tentative Hold, but not a Requested, ended or lapsed booking", () => {
    const bookings = [
      booking({ id: "1", status: "Tentative Hold", holdExpiresAt: new Date("2026-10-25T00:00:00+08:00") }),
      booking({ id: "2", status: "Requested" }),
      booking({ id: "3", status: "Released" }),
      booking({ id: "4", status: "Cancelled" }),
      booking({ id: "5", status: "Tentative Hold", holdExpiresAt: new Date("2026-10-22T00:00:00+08:00") }),
    ];

    expect(flagsForVenueChange(before, banquetSeats(80), bookings, NOW).map((flag) => flag.bookingId)).toEqual([
      "1",
    ]);
  });

  it("AC6: does not flag a booking whose time has passed, but does one still running", () => {
    const bookings = [
      booking({ id: "past", slots: [{ date: "2026-10-22", slot: "52" }] }),
      booking({ id: "now", slots: [{ date: "2026-10-23", slot: "39" }, { date: "2026-10-23", slot: "40" }] }),
      booking({ id: "ended-just-now", slots: [{ date: "2026-10-23", slot: "39" }] }),
    ];

    expect(flagsForVenueChange(before, banquetSeats(80), bookings, NOW).map((flag) => flag.bookingId)).toEqual([
      "now",
    ]);
  });

  it("AC7: judges each booking on its own: one that still fits is left alone beside one that is flagged", () => {
    const bookings = [
      booking({ id: "big" }),
      booking({ id: "small", needs: { ...booking().needs, expectedAttendance: 60 } }),
    ];

    expect(flagsForVenueChange(before, banquetSeats(80), bookings, NOW).map((flag) => flag.bookingId)).toEqual([
      "big",
    ]);
  });

  it("AC8: restates a check that was failing and still fails with a new reason, without starting a flag", () => {
    expect(flagsForVenueChange(banquetSeats(80), banquetSeats(70), [booking()], NOW)).toEqual([
      {
        bookingId: "812",
        sourceRef: "capacity:Banquet",
        detail: "Capacity: Banquet seats 70, 50 over",
        startsFailing: false,
      },
    ]);
  });

  it("AC8: says nothing when the same venue is saved again unchanged", () => {
    expect(flagsForVenueChange(banquetSeats(80), banquetSeats(80), [booking()], NOW)).toEqual([]);
  });
});
