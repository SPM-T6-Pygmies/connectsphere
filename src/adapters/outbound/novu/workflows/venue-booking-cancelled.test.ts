import { describe, expect, it } from "vitest";

import type { VenueBookingCancelledNotice } from "@/core/ports/outbound/notifier";

import { venueBookingCancelled, venueBookingCancelledInApp } from "./venue-booking-cancelled";

function notice(overrides: Partial<VenueBookingCancelledNotice> = {}): VenueBookingCancelledNotice {
  return {
    recipientUserAccountId: "5",
    bookingId: "31",
    venueId: "2",
    venueLocation: "Grand Ballroom",
    eventName: "Harbour Lights Gala",
    times: [
      { date: "2026-11-20", start: "13:00", end: "18:00" },
      { date: "2026-11-21", start: "07:00", end: "12:00" },
    ],
    ...overrides,
  };
}

describe("venueBookingCancelledInApp (SPM-63)", () => {
  it("AC4: opens the venue's calendar on the week of the first released date, in the same tab", () => {
    expect(venueBookingCancelledInApp(notice()).redirect).toEqual({
      url: "/staff/venue/catalogue/2/calendar?from=2026-11-20",
      target: "_self",
    });
  });
});

describe("venueBookingCancelled (SPM-63)", () => {
  it("AC1: cannot be switched off, so Venue Staff always learn a confirmed booking is gone", async () => {
    const definition = await venueBookingCancelled.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("AC1: is named for people in the preferences sheet, not by its id", async () => {
    const definition = await venueBookingCancelled.discover();

    expect(definition.name).toBe("Booking cancelled");
  });
});
