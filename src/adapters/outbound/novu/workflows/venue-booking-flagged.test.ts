import { describe, expect, it } from "vitest";

import type { VenueBookingFlaggedNotice } from "@/core/ports/outbound/notifier";

import { venueBookingFlagged, venueBookingFlaggedInApp } from "./venue-booking-flagged";

function notice(overrides: Partial<VenueBookingFlaggedNotice> = {}): VenueBookingFlaggedNotice {
  return {
    recipientUserAccountId: "3",
    bookingId: "31",
    eventId: "8",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    reasonCode: "venue-attributes",
    reasons: ["Capacity: Banquet seats 80, 40 over"],
    ...overrides,
  };
}

describe("venueBookingFlaggedInApp (SPM-71)", () => {
  it("AC5: opens the flagged booking on the event's Venue tab, in the same tab", () => {
    expect(venueBookingFlaggedInApp(notice()).redirect).toEqual({
      url: "/staff/coordinator/events/8?tab=venue&booking=31",
      target: "_self",
    });
  });
});

describe("venueBookingFlagged (SPM-71)", () => {
  it("AC1, AC2: cannot be switched off, so the coordinator always learns a booking is flagged", async () => {
    const definition = await venueBookingFlagged.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("AC1, AC2: is named for people in the preferences sheet, not by its id", async () => {
    const definition = await venueBookingFlagged.discover();

    expect(definition.name).toBe("Booking flagged");
  });
});
