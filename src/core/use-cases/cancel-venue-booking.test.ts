import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryCoordinatorEventRepository } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueUnavailabilityRepository } from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  CoordinatorEventNotFoundError,
} from "@/core/domain/errors";
import { venueId, type Venue } from "@/core/domain/venue";

import { CancelVenueBookingUseCase } from "./cancel-venue-booking";
import { ViewVenueCalendarUseCase } from "./view-venue-calendar";

const COORDINATOR = "coordinator-1";
const NOW = new Date("2026-11-01T09:00:00+08:00");

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 200,
  facilities: null,
  accessibility: null,
  slots: ["AM", "PM", "Night"],
  bookingHorizonDays: 90,
  layouts: [],
};

function booking(overrides: Partial<StoredBooking> = {}): StoredBooking {
  return {
    id: "booking-1",
    eventId: "event-1",
    venueId: HALL.id,
    venueLocation: "Main Hall",
    roomLayoutName: null,
    status: "Confirmed",
    slots: [{ date: "2026-11-03", slot: "AM" }],
    requestedBy: COORDINATOR,
    requestedAt: "2026-10-28T00:00:00.000Z",
    ...overrides,
  };
}

function build(
  seed: readonly StoredBooking[] = [booking()],
  eventStatus: CoordinatorEventStatus = "Planning",
) {
  const bookings = new InMemoryBookingRepository(seed);
  const useCase = new CancelVenueBookingUseCase({
    events: new InMemoryCoordinatorEventRepository([
      {
        id: "event-1",
        eventRequestId: "request-1",
        name: "Annual Conference",
        clientOrganisationName: "Acme",
        preferredDate: "2026-11-03",
        status: eventStatus,
        assignedCoordinatorUserAccountId: COORDINATOR,
        description: null,
        expectedAttendance: 100,
        clientOrganisationId: "org-1",
        owningOrganiserUserAccountId: "organiser-1",
      },
    ]),
    bookings,
  });
  const clock = new FixedClock(NOW);
  const calendar = new ViewVenueCalendarUseCase({
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings,
    blocks: new InMemoryVenueUnavailabilityRepository(clock),
    clock,
    timeZone: "Asia/Singapore",
  });
  return { useCase, bookings, calendar };
}

const command = (overrides: Record<string, unknown> = {}) => ({
  eventId: "event-1",
  bookingId: "booking-1",
  userAccountId: COORDINATOR,
  ...overrides,
});

describe("CancelVenueBookingUseCase (SPM-20)", () => {
  it("releases a Confirmed booking and names its venue (AC2)", async () => {
    const { useCase, bookings } = build();

    const result = await useCase.execute(command());

    expect(result).toEqual({ bookingId: "booking-1", venueLocation: "Main Hall" });
    expect(bookings.all()[0].status).toBe("Released");
  });

  it("shows the freed slot as available on the venue calendar straight away (AC2)", async () => {
    const { useCase, calendar } = build();
    const slotOn = async () =>
      (await calendar.execute({ venueId: HALL.id, from: "2026-11-03" })).days[0].slots[0].status;

    expect(await slotOn()).toBe("booked");
    await useCase.execute(command());
    expect(await slotOn()).toBe("available");
  });

  it("can cancel at any stage of the event (AC1)", async () => {
    const { useCase, bookings } = build([booking()], "Confirmed");

    await useCase.execute(command());

    expect(bookings.all()[0].status).toBe("Released");
  });

  it("leaves another booking on the same event as it was", async () => {
    const { useCase, bookings } = build([
      booking(),
      booking({ id: "booking-2", slots: [{ date: "2026-11-03", slot: "PM" }] }),
    ]);

    await useCase.execute(command());

    expect(bookings.all().map(({ status }) => status)).toEqual(["Released", "Confirmed"]);
  });

  it("refuses a booking that already holds nothing", async () => {
    const { useCase, bookings } = build([booking({ status: "Rejected" })]);

    await expect(useCase.execute(command())).rejects.toThrow(BookingNotCancellableError);
    expect(bookings.all()[0].status).toBe("Rejected");
  });

  it("refuses a booking that is not on this event", async () => {
    const { useCase } = build([booking({ eventId: "event-2" })]);

    await expect(useCase.execute(command())).rejects.toThrow(BookingNotFoundError);
  });

  it("tells a coordinator who is not assigned the same as an event that does not exist (AC1, #91)", async () => {
    const { useCase, bookings } = build();

    await expect(
      useCase.execute(command({ userAccountId: "coordinator-2" })),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(bookings.all()[0].status).toBe("Confirmed");
  });
});
