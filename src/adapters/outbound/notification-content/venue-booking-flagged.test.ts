import { describe, expect, it } from "vitest";

import type { VenueBookingFlaggedNotice } from "@/core/ports/outbound/notifier";

import { venueBookingFlaggedMessage } from "./venue-booking-flagged";

function notice(overrides: Partial<VenueBookingFlaggedNotice> = {}): VenueBookingFlaggedNotice {
  return {
    recipientUserAccountId: "3",
    bookingId: "31",
    eventId: "8",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    reasonCode: "venue-unavailable",
    reasons: ["Maintenance: 2026-11-16 13:00 to 18:00"],
    ...overrides,
  };
}

describe("venueBookingFlaggedMessage (SPM-71)", () => {
  it("AC3, AC5: names the event, the venue and the block's reason, and says nothing was changed", () => {
    expect(venueBookingFlaggedMessage(notice())).toEqual({
      subject: "Grand Ballroom booking flagged for Harbour Lights Gala",
      body: "Your booking of Grand Ballroom for Harbour Lights Gala is flagged for review. Venue unavailable: Maintenance: 2026-11-16 13:00 to 18:00. Nothing has been cancelled or rebooked; open the event's Venue tab to decide what to do.",
    });
  });

  it("AC3, AC4: names a venue edit as Venue changed and lists each of its reasons", () => {
    const { body } = venueBookingFlaggedMessage(
      notice({
        reasonCode: "venue-attributes",
        reasons: ["Capacity: Banquet seats 80, 40 over", "Facilities: Missing: Wi-Fi"],
      }),
    );

    expect(body).toContain("Venue changed: Capacity: Banquet seats 80, 40 over; Facilities: Missing: Wi-Fi.");
  });
});
