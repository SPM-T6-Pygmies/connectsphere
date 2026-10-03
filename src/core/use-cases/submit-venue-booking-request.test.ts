import { describe, expect, it } from "vitest";

import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import {
  CoordinatorEventNotFoundError,
  RoomLayoutRequiredError,
  VenueNotFoundError,
  VenueSlotUnavailableError,
} from "@/core/domain/errors";
import { venueId, type Venue } from "@/core/domain/venue";

import { SubmitVenueBookingRequestUseCase } from "./submit-venue-booking-request";

const COORDINATOR = "coordinator-1";
const OTHER_COORDINATOR = "coordinator-2";

const EVENT: SeedCoordinatorEvent = {
  id: "event-1",
  eventRequestId: "request-1",
  name: "Annual Conference",
  clientOrganisationName: "Acme",
  preferredDate: "2026-10-05",
  status: "Planning",
  assignedCoordinatorUserAccountId: COORDINATOR,
};

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 300,
  facilities: null,
  accessibility: null,
  operatingHoursStart: null,
  operatingHoursEnd: null,
  bookingHorizonDays: null,
  layouts: [
    { name: "Theatre", capacity: 300 },
    { name: "Banquet", capacity: 180 },
  ],
};

const STUDIO: Venue = {
  id: venueId("venue-studio"),
  location: "Studio",
  capacity: 40,
  facilities: null,
  accessibility: null,
  operatingHoursStart: null,
  operatingHoursEnd: null,
  bookingHorizonDays: null,
  layouts: [{ name: "Classroom", capacity: 40 }],
};

const SLOT_TIMES = {
  AM: { start: "09:00", end: "12:00" },
  PM: { start: "13:00", end: "17:00" },
  Night: { start: "18:00", end: "21:00" },
} as const;

function confirmedAt(
  venue: string,
  date: string,
  slot: "AM" | "PM" | "Night",
): StoredBooking {
  return {
    id: "existing-1",
    eventId: "event-other",
    venueId: venue,
    venueLocation: venue,
    roomLayoutName: null,
    status: "Confirmed",
    slots: [{ date, ...SLOT_TIMES[slot] }],
    requestedBy: OTHER_COORDINATOR,
    requestedAt: "2026-09-20T00:00:00.000Z",
  };
}

function buildUseCase(existing: readonly StoredBooking[] = []) {
  const bookings = new InMemoryBookingRepository(existing);
  const useCase = new SubmitVenueBookingRequestUseCase({
    events: new InMemoryCoordinatorEventRepository([EVENT]),
    venues: new InMemoryVenueCatalogue([HALL, STUDIO]),
    bookings,
  });
  return { useCase, bookings };
}

describe("SubmitVenueBookingRequestUseCase (SPM-46)", () => {
  it("records the assigned coordinator's request for Venue Staff to review (AC1, AC2)", async () => {
    const { useCase, bookings } = buildUseCase();

    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Banquet",
      slots: [
        { date: "2026-10-05", start: "13:00", end: "17:00" },
        { date: "2026-10-05", start: "09:00", end: "12:00" },
      ],
    });

    expect(result).toEqual({
      bookingId: "booking-1",
      status: "Requested",
      venueLocation: "Main Hall",
    });
    expect(bookings.all()).toEqual([
      expect.objectContaining({
        eventId: "event-1",
        venueId: "venue-hall",
        roomLayoutName: "Banquet",
        status: "Requested",
        requestedBy: COORDINATOR,
        slots: [
          { date: "2026-10-05", start: "09:00", end: "12:00" },
          { date: "2026-10-05", start: "13:00", end: "17:00" },
        ],
      }),
    ]);
  });

  it("carries a single-layout venue's layout without asking for it", async () => {
    const { useCase, bookings } = buildUseCase();

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-studio",
      roomLayout: null,
      slots: [{ date: "2026-10-05", start: "09:00", end: "12:00" }],
    });

    expect(bookings.all()[0]).toMatchObject({ roomLayoutName: "Classroom" });
  });

  it("refuses a multi-layout venue with no layout chosen, storing nothing (AC2)", async () => {
    const { useCase, bookings } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: null,
        slots: [{ date: "2026-10-05", start: "09:00", end: "12:00" }],
      }),
    ).rejects.toThrow(RoomLayoutRequiredError);
    expect(bookings.all()).toEqual([]);
  });

  it("blocks a slot the venue already has confirmed, storing nothing (AC4)", async () => {
    const { useCase, bookings } = buildUseCase([
      confirmedAt("venue-hall", "2026-10-05", "PM"),
    ]);

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", start: "13:00", end: "17:00" }],
      }),
    ).rejects.toThrow(VenueSlotUnavailableError);
    expect(bookings.all()).toHaveLength(1);
  });

  it("does not block on the same slot confirmed at a different venue (AC4)", async () => {
    const { useCase, bookings } = buildUseCase([
      confirmedAt("venue-studio", "2026-10-05", "PM"),
    ]);

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Theatre",
      slots: [{ date: "2026-10-05", start: "13:00", end: "17:00" }],
    });

    expect(bookings.all()).toHaveLength(2);
  });

  it("answers another coordinator as if the event did not exist (#91)", async () => {
    const { useCase, bookings } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: OTHER_COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", start: "09:00", end: "12:00" }],
      }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(bookings.all()).toEqual([]);
  });

  it("refuses an event that does not exist", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-404",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", start: "09:00", end: "12:00" }],
      }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
  });

  it("refuses a venue that is not in the catalogue", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-404",
        roomLayout: null,
        slots: [{ date: "2026-10-05", start: "09:00", end: "12:00" }],
      }),
    ).rejects.toThrow(VenueNotFoundError);
  });
});
