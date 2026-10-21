import { describe, expect, it } from "vitest";

import type { VenueBookingDecidedNotice } from "@/core/ports/outbound/notifier";

import { venueBookingDecided, venueBookingDecidedInApp } from "./venue-booking-decided";

function notice(overrides: Partial<VenueBookingDecidedNotice> = {}): VenueBookingDecidedNotice {
  return {
    recipientUserAccountId: "3",
    bookingId: "31",
    eventId: "8",
    eventRequestId: "6",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    slots: [{ date: "2026-11-20", slot: "PM" }],
    outcome: "Rejected",
    reason: "Closed for resurfacing.",
    suggestedAlternativeLocation: "Main Hall",
    ...overrides,
  };
}

describe("venueBookingDecidedInApp (SPM-62)", () => {
  it("AC3: opens the booking on its event's Venue tab, in the same tab", () => {
    expect(venueBookingDecidedInApp(notice()).redirect).toEqual({
      url: "/staff/coordinator/events/8?tab=venue&booking=31",
      target: "_self",
    });
  });

  it("AC3: opens the booking the same way when the event has no source request", () => {
    expect(venueBookingDecidedInApp(notice({ eventRequestId: null })).redirect.url).toBe(
      "/staff/coordinator/events/8?tab=venue&booking=31",
    );
  });
});

describe("venueBookingDecided (SPM-62)", () => {
  it("cannot be switched off, so a coordinator always learns whether the venue is secured", async () => {
    const definition = await venueBookingDecided.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("is named for people in the preferences sheet, not by its id", async () => {
    const definition = await venueBookingDecided.discover();

    expect(definition.name).toBe("Booking decided");
  });
});
