import { describe, expect, it } from "vitest";

import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryEventAttendance } from "@/adapters/outbound/in-memory/in-memory-event-attendance";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import { BookingNotFoundError } from "../domain/errors";
import { venueId, type Venue } from "../domain/venue";
import type { BookingId } from "../domain/booking";
import { CheckBookingCapacityUseCase } from "./check-booking-capacity";

const HALL: Venue = {
  id: venueId("v1"),
  location: "Harbour Hall",
  facilities: "Projector",
  accessibility: "Step-free access",
  operatingHoursStart: "09:00",
  operatingHoursEnd: "18:00",
  capacity: 999,
  bookingHorizonDays: 60,
  layouts: [
    { name: "Theatre", capacity: 200 },
    { name: "Boardroom", capacity: 20 },
  ],
};

async function build() {
  const bookings = new InMemoryBookingRepository();
  const attendance = new InMemoryEventAttendance({ e1: 100 });
  const booking = await bookings.add({ eventId: "e1", venueId: HALL.id, roomLayout: "Boardroom" });
  const useCase = new CheckBookingCapacityUseCase({
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings,
    attendance,
  });
  return { useCase, booking, attendance };
}

describe("CheckBookingCapacityUseCase (SPM-104)", () => {
  it("reads the capacity of the layout the booking assumes, never the venue-wide figure", async () => {
    const { useCase, booking } = await build();

    const result = await useCase.execute({ bookingId: booking.id });

    expect(result).toEqual({
      layout: "Boardroom",
      capacity: 20,
      expectedAttendance: 100,
      withinCapacity: false,
    });
  });

  it("reflects the event's current attendance, not the figure when the booking was made", async () => {
    const { useCase, booking, attendance } = await build();
    attendance.set("e1", 15);

    const result = await useCase.execute({ bookingId: booking.id });

    expect(result.expectedAttendance).toBe(15);
    expect(result.withinCapacity).toBe(true);
  });

  it("refuses a booking that does not exist", async () => {
    const { useCase } = await build();

    await expect(useCase.execute({ bookingId: "missing" as BookingId })).rejects.toThrow(
      BookingNotFoundError,
    );
  });
});
