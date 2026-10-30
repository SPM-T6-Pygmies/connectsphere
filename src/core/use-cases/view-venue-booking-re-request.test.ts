import { describe, expect, it } from "vitest";

import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryCoordinatorEventRepository } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import type { BookingId } from "../domain/booking";
import { venueId, type Venue } from "../domain/venue";
import type { EventBookingFlag } from "../ports/outbound/booking-flag-repository";
import { ViewVenueBookingOptionsUseCase } from "./view-venue-booking-options";

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 200,
  facilities: null,
  accessibility: null,
  openingHours: [{ start: "00:00", end: "24:00" }],
  bookingHorizonDays: null,
  layouts: [
    { name: "Theatre", capacity: 200 },
    { name: "Banquet", capacity: 120 },
  ],
};

const FLAGGED: StoredBooking = {
  id: "booking-1",
  eventId: "event-1",
  venueId: "venue-hall",
  venueLocation: "Main Hall",
  roomLayoutName: "Theatre",
  status: "Confirmed",
  times: [{ date: "2026-11-16", start: "13:00", end: "18:00" }],
  requestedBy: "coordinator-1",
  requestedAt: "2026-10-01T00:00:00.000Z",
};

const FLAG: EventBookingFlag = {
  flagId: "flag-1",
  bookingId: "booking-1" as BookingId,
  venueLocation: "Main Hall",
  status: "Confirmed",
  holdExpiresAt: null,
  bookedFor: "2026-11-16 13:00 to 18:00",
  reasonCode: "venue-attributes",
  detail: "Capacity lowered to 100",
  flaggedAt: "2026-10-25T00:00:00.000Z",
  sourceLiftedAt: null,
};

/** The event moved to the 17th and now prefers Banquet; booking-1 is flagged for it. */
function view(stored: readonly StoredBooking[] = [FLAGGED], flags: readonly EventBookingFlag[] = [FLAG]) {
  return new ViewVenueBookingOptionsUseCase({
    flags: { openForEvent: async () => flags, clear: async () => {} },
    events: new InMemoryCoordinatorEventRepository([
      {
        id: "event-1",
        eventRequestId: "request-1",
        name: "Tech Summit",
        clientOrganisationName: "Sunrise Events Co",
        preferredDate: "2026-11-17",
        status: "Planning",
        assignedCoordinatorUserAccountId: "coordinator-1",
        times: [{ date: "2026-11-17", start: "09:00", end: "12:00" }],
        expectedAttendance: 110,
        roomLayoutPreference: "Banquet",
        description: null,
        clientOrganisationId: "org-1",
        owningOrganiserUserAccountId: "organiser-1",
      },
    ]),
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings: new InMemoryBookingRepository(stored),
  });
}

describe("ViewVenueBookingOptionsUseCase re-requesting a flagged booking (SPM-251)", () => {
  it("AC1, AC2: starts the form from the event as it is now, at the booking's venue", async () => {
    const result = await view().execute({ eventId: "event-1", userAccountId: "coordinator-1", reRequesting: "booking-1" });

    expect(result?.reRequest).toEqual({
      bookingId: "booking-1",
      venueLocation: "Main Hall",
      bookedFor: "2026-11-16 13:00 to 18:00",
      venueId: "venue-hall",
      roomLayout: "Banquet",
      times: [{ date: "2026-11-17", start: "09:00", end: "12:00" }],
    });
  });

  it("AC1: a booking with no open flag starts the ordinary form", async () => {
    const result = await view([FLAGGED], []).execute({ eventId: "event-1", userAccountId: "coordinator-1", reRequesting: "booking-1" });

    expect(result?.reRequest).toBeNull();
  });

  it("AC1: another coordinator sees nothing at all", async () => {
    await expect(
      view().execute({ eventId: "event-1", userAccountId: "coordinator-2", reRequesting: "booking-1" }),
    ).resolves.toBeNull();
  });

  it("AC9: a booking with a re-request waiting is listed as such and starts no second one", async () => {
    const waiting: StoredBooking = { ...FLAGGED, id: "booking-2", status: "Requested", replacesBookingId: "booking-1" };
    const result = await view([FLAGGED, waiting]).execute({ eventId: "event-1", userAccountId: "coordinator-1", reRequesting: "booking-1" });

    expect(result?.reRequestsWaiting).toEqual(["booking-1"]);
    expect(result?.reRequest).toBeNull();
  });

  it("AC7: a rejected re-request leaves nothing waiting", async () => {
    const rejected: StoredBooking = { ...FLAGGED, id: "booking-2", status: "Rejected", replacesBookingId: "booking-1" };
    const result = await view([FLAGGED, rejected]).execute({ eventId: "event-1", userAccountId: "coordinator-1", reRequesting: "booking-1" });

    expect(result?.reRequestsWaiting).toEqual([]);
    expect(result?.reRequest?.bookingId).toBe("booking-1");
  });
});
