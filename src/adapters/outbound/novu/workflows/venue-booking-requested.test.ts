import { describe, expect, it } from "vitest";

import { venueBookingRequested, venueBookingRequestedInApp } from "./venue-booking-requested";

describe("venueBookingRequestedInApp (SPM-61)", () => {
  it("AC3: opens the pending booking request in the Venue Staff workspace, in the same tab", () => {
    const inApp = venueBookingRequestedInApp({
      recipientUserAccountId: "5",
      bookingId: "31",
      eventName: "Harbour Lights Gala",
      venueLocation: "Grand Ballroom",
      times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
    });

    expect(inApp.redirect).toEqual({ url: "/staff/venue/31", target: "_self" });
  });
});

describe("venueBookingRequested (SPM-61)", () => {
  it("cannot be switched off, so a request never sits unreviewed for want of the notice", async () => {
    const definition = await venueBookingRequested.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("is named for people in the preferences sheet, not by its id", async () => {
    const definition = await venueBookingRequested.discover();

    expect(definition.name).toBe("Booking requested");
  });
});
