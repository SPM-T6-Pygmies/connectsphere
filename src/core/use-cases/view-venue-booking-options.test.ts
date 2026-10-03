import { describe, expect, it } from "vitest";

import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryCoordinatorEventRepository } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { venueId, type Venue } from "@/core/domain/venue";

import { ViewVenueBookingOptionsUseCase } from "./view-venue-booking-options";

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 300,
  facilities: "Stage",
  accessibility: "Step-free",
  operatingHoursStart: null,
  operatingHoursEnd: null,
  bookingHorizonDays: null,
  layouts: [{ name: "Theatre", capacity: 300 }],
};

function buildUseCase() {
  return new ViewVenueBookingOptionsUseCase({
    events: new InMemoryCoordinatorEventRepository([
      {
        id: "event-1",
        eventRequestId: "request-1",
        name: "Annual Conference",
        clientOrganisationName: "Acme",
        preferredDate: "2026-10-05",
        status: "Planning",
        assignedCoordinatorUserAccountId: "coordinator-1",
        startTime: "2026-10-05T01:00:00.000Z",
        endTime: "2026-10-05T04:00:00.000Z",
        expectedAttendance: 120,
        venueRequirements: "Stage and projector",
      },
    ]),
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings: new InMemoryBookingRepository([
      {
        id: "booking-1",
        eventId: "event-1",
        venueId: "venue-hall",
        venueLocation: "Main Hall",
        roomLayoutName: "Theatre",
        status: "Requested",
        slots: [{ date: "2026-10-05", start: "09:00", end: "10:30" }],
        requestedBy: "coordinator-1",
        requestedAt: "2026-09-27T00:00:00.000Z",
      },
      {
        id: "booking-2",
        eventId: "event-other",
        venueId: "venue-hall",
        venueLocation: "Main Hall",
        roomLayoutName: null,
        status: "Confirmed",
        slots: [{ date: "2026-10-06", start: "09:00", end: "10:30" }],
        requestedBy: "coordinator-2",
        requestedAt: "2026-09-27T00:00:00.000Z",
      },
    ]),
  });
}

describe("ViewVenueBookingOptionsUseCase (SPM-46)", () => {
  it("shows the event's timing and venue requirements, the venues, and this event's bookings (AC3)", async () => {
    const result = await buildUseCase().execute({
      eventRequestId: "request-1",
      userAccountId: "coordinator-1",
    });

    expect(result?.event).toMatchObject({
      id: "event-1",
      preferredDate: "2026-10-05",
      startTime: "2026-10-05T01:00:00.000Z",
      endTime: "2026-10-05T04:00:00.000Z",
      expectedAttendance: 120,
      venueRequirements: "Stage and projector",
    });
    expect(result?.venues).toEqual([HALL]);
    expect(result?.bookings.map((booking) => booking.id)).toEqual([
      "booking-1",
    ]);
  });

  it("returns nothing to a coordinator the event is not assigned to (#91)", async () => {
    await expect(
      buildUseCase().execute({
        eventRequestId: "request-1",
        userAccountId: "coordinator-2",
      }),
    ).resolves.toBeNull();
  });
});
