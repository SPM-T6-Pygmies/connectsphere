import { describe, expect, it } from "vitest";

import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryCoordinatorEventRepository } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import {
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  CoordinatorEventNotFoundError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
} from "@/core/domain/errors";
import { venueId, type Venue } from "@/core/domain/venue";

import { ChangeBookingRoomLayoutUseCase } from "./change-booking-room-layout";

const COORDINATOR = "coordinator-1";

// The venue-wide figure is deliberately unlike either layout's.
const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 999,
  facilities: null,
  accessibility: null,
  operatingHoursStart: null,
  operatingHoursEnd: null,
  bookingHorizonDays: null,
  layouts: [
    { name: "Theatre", capacity: 200 },
    { name: "Boardroom", capacity: 20 },
  ],
};

function booking(overrides: Partial<StoredBooking> = {}): StoredBooking {
  return {
    id: "booking-1",
    eventId: "event-1",
    venueId: HALL.id,
    venueLocation: "Main Hall",
    roomLayoutName: "Theatre",
    status: "Requested",
    slots: [{ date: "2026-10-05", slot: "AM" }],
    requestedBy: COORDINATOR,
    requestedAt: "2026-09-28T00:00:00.000Z",
    ...overrides,
  };
}

function build(
  seed: readonly StoredBooking[] = [booking()],
  expectedAttendance: number | null = 100,
) {
  const bookings = new InMemoryBookingRepository(seed);
  const useCase = new ChangeBookingRoomLayoutUseCase({
    events: new InMemoryCoordinatorEventRepository([
      {
        id: "event-1",
        eventRequestId: "request-1",
        name: "Annual Conference",
        clientOrganisationName: "Acme",
        preferredDate: "2026-10-05",
        status: "Planning",
        assignedCoordinatorUserAccountId: COORDINATOR,
        description: null,
        expectedAttendance,
        clientOrganisationId: "org-1",
        owningOrganiserUserAccountId: "organiser-1",
      },
    ]),
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings,
  });
  return { useCase, bookings };
}

const command = (overrides: Record<string, unknown> = {}) => ({
  eventId: "event-1",
  bookingId: "booking-1",
  userAccountId: COORDINATOR,
  roomLayout: "Boardroom" as string | null,
  ...overrides,
});

describe("ChangeBookingRoomLayoutUseCase (SPM-104)", () => {
  it("records the new layout and checks the event against that layout's capacity", async () => {
    const { useCase, bookings } = build();

    const result = await useCase.execute(command());

    expect(result.capacity).toEqual({
      layout: "Boardroom",
      capacity: 20,
      expectedAttendance: 100,
      withinCapacity: false,
    });
    expect(bookings.all()[0].roomLayoutName).toBe("Boardroom");
  });

  it("clears a failing check when the change moves to a layout that fits", async () => {
    const { useCase } = build([booking({ roomLayoutName: "Boardroom" })]);

    const result = await useCase.execute(command({ roomLayout: "Theatre" }));

    expect(result.capacity.withinCapacity).toBe(true);
  });

  it("leaves the booking as it was when the new layout is not supported", async () => {
    const { useCase, bookings } = build();

    await expect(
      useCase.execute(command({ roomLayout: "Banquet" })),
    ).rejects.toThrow(UnsupportedRoomLayoutError);
    expect(bookings.all()[0].roomLayoutName).toBe("Theatre");
  });

  it("leaves the booking as it was when no layout is given for a venue with a choice", async () => {
    const { useCase, bookings } = build();

    await expect(
      useCase.execute(command({ roomLayout: null })),
    ).rejects.toThrow(RoomLayoutRequiredError);
    expect(bookings.all()[0].roomLayoutName).toBe("Theatre");
  });

  it("refuses once Venue Staff have answered the request", async () => {
    const { useCase, bookings } = build([booking({ status: "Confirmed" })]);

    await expect(useCase.execute(command())).rejects.toThrow(
      BookingRoomLayoutNotChangeableError,
    );
    expect(bookings.all()[0].roomLayoutName).toBe("Theatre");
  });

  it("refuses a booking that is not on this event", async () => {
    const { useCase } = build();

    await expect(
      useCase.execute(command({ bookingId: "booking-9" })),
    ).rejects.toThrow(BookingNotFoundError);
  });

  it("tells a coordinator who is not assigned the same as an event that does not exist (#91)", async () => {
    const { useCase, bookings } = build();

    await expect(
      useCase.execute(command({ userAccountId: "coordinator-2" })),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(bookings.all()[0].roomLayoutName).toBe("Theatre");
  });

  it("gives no verdict while the event has no expected attendance", async () => {
    const { useCase } = build([booking()], null);

    const result = await useCase.execute(command());

    expect(result.capacity.withinCapacity).toBeNull();
  });
});
