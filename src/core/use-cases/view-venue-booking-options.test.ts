import { describe, expect, it } from "vitest";

import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryCoordinatorEventRepository } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { venueId, type Venue } from "@/core/domain/venue";
import type { BookingStatus } from "@/core/domain/booking";
import type { SeedCoordinatorEvent } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";

import { ViewVenueBookingOptionsUseCase } from "./view-venue-booking-options";

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 300,
  facilities: "Stage",
  accessibility: "Step-free",
  slots: [],
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
        slots: [{ date: "2026-10-05", slot: "AM" }],
        expectedAttendance: 120,
        venueRequirements: "Stage and projector",
        description: null,
        clientOrganisationId: "org-1",
        owningOrganiserUserAccountId: "organiser-1",
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
        slots: [{ date: "2026-10-05", slot: "AM" }],
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
        slots: [{ date: "2026-10-06", slot: "AM" }],
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
      slots: [{ date: "2026-10-05", slot: "AM" }],
      expectedAttendance: 120,
      venueRequirements: "Stage and projector",
    });
    expect(result?.venues).toEqual([HALL]);
    expect(result?.bookings.map((booking) => booking.id)).toEqual(["booking-1"]);
  });

  it("returns nothing to a coordinator the event is not assigned to (#91)", async () => {
    await expect(
      buildUseCase().execute({ eventRequestId: "request-1", userAccountId: "coordinator-2" }),
    ).resolves.toBeNull();
  });
});

// SPM-248: the page's verdicts, always from the event's needs as they are now.
describe("ViewVenueBookingOptionsUseCase suitability (SPM-248)", () => {
  const STUDIO: Venue = {
    id: venueId("venue-studio"),
    location: "Studio",
    capacity: 60,
    facilities: "Wi-Fi, Video-conferencing",
    accessibility: "Step-free access",
    slots: [],
    bookingHorizonDays: null,
    layouts: [{ name: "Theatre", capacity: 60 }],
  };
  const ROOFTOP: Venue = {
    id: venueId("venue-rooftop"),
    location: "Rooftop Terrace",
    capacity: 150,
    facilities: "Catering area",
    accessibility: "Lift access",
    slots: [],
    bookingHorizonDays: null,
    layouts: [
      { name: "Banquet", capacity: 120 },
      { name: "Exhibition", capacity: 150 },
    ],
  };
  const BARE: Venue = { ...STUDIO, id: venueId("venue-bare"), location: "Bare Room", layouts: [] };

  function event(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
    return {
      id: "event-1",
      eventRequestId: "request-1",
      name: "Founders' Gala",
      clientOrganisationName: "Acme",
      preferredDate: "2026-10-05",
      status: "Planning",
      assignedCoordinatorUserAccountId: "coordinator-1",
      expectedAttendance: 50,
      roomLayoutPreference: "Theatre",
      accessibilityRequirements: "Step-free access",
      requiredFacilities: "Video-conferencing",
      description: null,
      clientOrganisationId: "org-1",
      owningOrganiserUserAccountId: "organiser-1",
      ...overrides,
    };
  }

  function booking(id: string, status: BookingStatus, venue: Venue, roomLayoutName: string | null) {
    return {
      id,
      eventId: "event-1",
      venueId: venue.id,
      venueLocation: venue.location,
      roomLayoutName,
      status,
      slots: [{ date: "2026-10-05", slot: "AM" as const }],
      requestedBy: "coordinator-1",
      requestedAt: "2026-09-27T00:00:00.000Z",
    };
  }

  function run(seed: SeedCoordinatorEvent, bookings: ReturnType<typeof booking>[] = [], userAccountId = "coordinator-1") {
    return new ViewVenueBookingOptionsUseCase({
      events: new InMemoryCoordinatorEventRepository([seed]),
      venues: new InMemoryVenueCatalogue([STUDIO, ROOFTOP, BARE]),
      bookings: new InMemoryBookingRepository(bookings),
    }).execute({ eventRequestId: "request-1", userAccountId });
  }

  it("works out a verdict for every venue and layout on offer, from the event's needs (AC3)", async () => {
    const result = await run(event());
    const verdict = (venue: Venue, layout: string | null) =>
      result?.venueSuitability.find((entry) => entry.venueId === venue.id && entry.layout === layout)?.suitability;

    expect(verdict(STUDIO, "Theatre")?.overall).toBe("Suitable");
    expect(verdict(ROOFTOP, "Banquet")?.overall).toBe("Not suitable");
    expect(verdict(ROOFTOP, "Banquet")?.failing).toEqual(["layout", "accessibility", "facilities"]);
    expect(result?.venueSuitability.filter((entry) => entry.venueId === ROOFTOP.id)).toHaveLength(2);
  });

  it("gives a venue with no layouts one verdict, on no layout", async () => {
    const result = await run(event());
    const entries = result?.venueSuitability.filter((entry) => entry.venueId === BARE.id);
    expect(entries).toHaveLength(1);
    expect(entries?.[0]?.layout).toBeNull();
  });

  it("works out a verdict for each booking that is Requested, Tentative Hold or Confirmed (AC8)", async () => {
    const result = await run(event(), [
      booking("b-requested", "Requested", STUDIO, "Theatre"),
      booking("b-hold", "Tentative Hold", STUDIO, "Theatre"),
      booking("b-confirmed", "Confirmed", ROOFTOP, "Banquet"),
    ]);
    expect(result?.bookingSuitability["b-requested"]?.overall).toBe("Suitable");
    expect(result?.bookingSuitability["b-hold"]?.overall).toBe("Suitable");
    expect(result?.bookingSuitability["b-confirmed"]?.overall).toBe("Not suitable");
  });

  it.each(["Rejected", "Released", "Cancelled"] as const)("gives a %s booking no verdict", async (status) => {
    const result = await run(event(), [booking("b-over", status, STUDIO, "Theatre")]);
    expect(result?.bookingSuitability["b-over"]).toBeUndefined();
  });

  it("checks a booking against the layout it was booked in, not the event's preference", async () => {
    const result = await run(event({ roomLayoutPreference: "Banquet", expectedAttendance: 100 }), [
      booking("b-1", "Requested", ROOFTOP, "Exhibition"),
    ]);
    const capacity = result?.bookingSuitability["b-1"]?.rows.find((row) => row.check === "capacity");
    expect(capacity?.detail).toBe("Exhibition seats 150 · fits the 100 expected");
  });

  it("changes the same booking's verdict when only the event's attendance changes", async () => {
    const bookings = [booking("b-1", "Requested", STUDIO, "Theatre")];
    const before = await run(event({ expectedAttendance: 50 }), bookings);
    const after = await run(event({ expectedAttendance: 80 }), bookings);
    expect(before?.bookingSuitability["b-1"]?.overall).toBe("Suitable");
    expect(after?.bookingSuitability["b-1"]?.overall).toBe("Not suitable");
    expect(after?.bookingSuitability["b-1"]?.rows.find((row) => row.check === "capacity")?.detail).toBe(
      "Theatre seats 60, 20 over",
    );
  });

  it("reflects the facilities and accessibility the event needs now", async () => {
    const bookings = [booking("b-1", "Confirmed", STUDIO, "Theatre")];
    const before = await run(event({ requiredFacilities: "Video-conferencing" }), bookings);
    const after = await run(event({ requiredFacilities: "Video-conferencing, Catering area" }), bookings);
    expect(before?.bookingSuitability["b-1"]?.overall).toBe("Suitable");
    expect(after?.bookingSuitability["b-1"]?.failing).toEqual(["facilities"]);
  });

  it("is Check incomplete, not wrong, when the event has no attendance yet", async () => {
    const result = await run(event({ expectedAttendance: null }), [booking("b-1", "Requested", STUDIO, "Theatre")]);
    expect(result?.bookingSuitability["b-1"]?.overall).toBe("Check incomplete");
  });

  it("returns nothing, not even verdicts, to a coordinator the event is not assigned to (AC9)", async () => {
    await expect(run(event(), [booking("b-1", "Requested", STUDIO, "Theatre")], "coordinator-2")).resolves.toBeNull();
  });
});
