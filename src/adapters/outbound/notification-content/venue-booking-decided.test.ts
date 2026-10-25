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
    times: [
      { date: "2026-11-20", start: "07:00", end: "12:00" },
      { date: "2026-11-20", start: "13:00", end: "18:00" },
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
      body: "Venue Staff confirmed Grand Ballroom for Fri, 20 Nov 2026 (07:00–12:00, 13:00–18:00). The venue is secured.",
    });
  });

  it("SPM-219 AC6: a released hold names the venue, the event and its slots, and says they are free", () => {
    expect(venueBookingDecidedMessage(notice({ outcome: "Released" }))).toEqual({
      subject: "Grand Ballroom hold released for Harbour Lights Gala",
      body: "Venue Staff released the hold on Grand Ballroom for Fri, 20 Nov 2026 (07:00–12:00, 13:00–18:00). The times are free for other events; send a new request if you still need them.",
    });
  });

  it("AC1, AC2: a rejection names the outcome and the venue, and carries the reason", () => {
    expect(
      venueBookingDecidedMessage(notice({ outcome: "Rejected", reason: "Closed for resurfacing." })),
    ).toEqual({
      subject: "Grand Ballroom rejected for Harbour Lights Gala",
      body: "Venue Staff rejected Grand Ballroom for Fri, 20 Nov 2026 (07:00–12:00, 13:00–18:00). Reason: Closed for resurfacing.",
    });
  });

  it("AC2: a suggested venue is passed on as a suggestion only, not a booking", () => {
    const message = venueBookingDecidedMessage(
      notice({ outcome: "Rejected", reason: "Closed for resurfacing.", suggestedAlternativeLocation: "Main Hall" }),
    );

    expect(message.body).toBe(
      "Venue Staff rejected Grand Ballroom for Fri, 20 Nov 2026 (07:00–12:00, 13:00–18:00). Reason: Closed for resurfacing. Suggested instead: Main Hall. This is only a suggestion; send a new request to book it.",
    );
  });
});
