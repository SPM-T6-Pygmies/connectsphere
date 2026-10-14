import { describe, expect, it } from "vitest";

import type { VenueBookingDecidedNotice } from "@/core/ports/outbound/notifier";

import { venueBookingDecidedMessage } from "./venue-booking-decided";

function notice(overrides: Partial<VenueBookingDecidedNotice> = {}): VenueBookingDecidedNotice {
  return {
    recipientUserAccountId: "3",
    bookingId: "31",
    eventId: "8",
    eventRequestId: "6",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    slots: [
      { date: "2026-11-20", slot: "AM" },
      { date: "2026-11-20", slot: "PM" },
    ],
    outcome: "Confirmed",
    reason: null,
    suggestedAlternativeLocation: null,
    ...overrides,
  };
}

describe("venueBookingDecidedMessage (SPM-62)", () => {
  it("AC1: an approval names the outcome, the venue, the event and its slots", () => {
    expect(venueBookingDecidedMessage(notice())).toEqual({
      subject: "Grand Ballroom approved for Harbour Lights Gala",
      body: "Venue Staff confirmed Grand Ballroom for Fri, 20 Nov 2026 (AM, PM). The venue is secured.",
    });
  });

  it("AC1, AC2: a rejection names the outcome and the venue, and carries the reason", () => {
    expect(
      venueBookingDecidedMessage(notice({ outcome: "Rejected", reason: "Closed for resurfacing." })),
    ).toEqual({
      subject: "Grand Ballroom rejected for Harbour Lights Gala",
      body: "Venue Staff rejected Grand Ballroom for Fri, 20 Nov 2026 (AM, PM). Reason: Closed for resurfacing.",
    });
  });

  it("AC2: a suggested venue is passed on as a suggestion only, not a booking", () => {
    const message = venueBookingDecidedMessage(
      notice({ outcome: "Rejected", reason: "Closed for resurfacing.", suggestedAlternativeLocation: "Main Hall" }),
    );

    expect(message.body).toBe(
      "Venue Staff rejected Grand Ballroom for Fri, 20 Nov 2026 (AM, PM). Reason: Closed for resurfacing. Suggested instead: Main Hall. This is only a suggestion; send a new request to book it.",
    );
  });
});
