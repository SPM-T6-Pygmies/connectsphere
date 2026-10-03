import { describe, expect, it } from "vitest";

import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryEventAttendance } from "@/adapters/outbound/in-memory/in-memory-event-attendance";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import {
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
} from "../domain/errors";
import type { BookingId } from "../domain/booking";
import { venueId, type Venue } from "../domain/venue";
import { ChangeBookingRoomLayoutUseCase } from "./change-booking-room-layout";

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

async function build(layout = "Theatre", status: "Requested" | "Confirmed" = "Requested") {
  const bookings = new InMemoryBookingRepository();
  const booking = await bookings.add({ eventId: "e1", venueId: HALL.id, roomLayout: layout });
  if (status !== "Requested") {
    bookings.setStatus(booking.id, status);
  }
  const useCase = new ChangeBookingRoomLayoutUseCase({
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings,
    attendance: new InMemoryEventAttendance({ e1: 100 }),
  });
  return { useCase, bookings, booking };
}

describe("ChangeBookingRoomLayoutUseCase (SPM-104)", () => {
  it("re-runs the capacity check against the new layout's figure", async () => {
    const { useCase, booking } = await build("Theatre");

    const result = await useCase.execute({ bookingId: booking.id, roomLayout: "Boardroom" });

    expect(result.booking.roomLayout).toBe("Boardroom");
    expect(result.capacity).toEqual({
      layout: "Boardroom",
      capacity: 20,
      expectedAttendance: 100,
      withinCapacity: false,
    });
  });

  it("persists the new layout", async () => {
    const { useCase, bookings, booking } = await build("Boardroom");

    await useCase.execute({ bookingId: booking.id, roomLayout: "Theatre" });

    expect((await bookings.find(booking.id))?.roomLayout).toBe("Theatre");
  });

  it("clears a failing check when the change moves to a layout that fits", async () => {
    const { useCase, booking } = await build("Boardroom");

    const result = await useCase.execute({ bookingId: booking.id, roomLayout: "Theatre" });

    expect(result.capacity.withinCapacity).toBe(true);
  });

  it("leaves the booking as it was when the new layout is not supported", async () => {
    const { useCase, bookings, booking } = await build("Theatre");

    await expect(
      useCase.execute({ bookingId: booking.id, roomLayout: "Banquet" }),
    ).rejects.toThrow(UnsupportedRoomLayoutError);
    expect((await bookings.find(booking.id))?.roomLayout).toBe("Theatre");
  });

  it("leaves the booking as it was when no layout is given", async () => {
    const { useCase, bookings, booking } = await build("Theatre");

    await expect(useCase.execute({ bookingId: booking.id, roomLayout: "" })).rejects.toThrow(
      RoomLayoutRequiredError,
    );
    expect((await bookings.find(booking.id))?.roomLayout).toBe("Theatre");
  });

  it("refuses a booking that does not exist", async () => {
    const { useCase } = await build();

    await expect(
      useCase.execute({ bookingId: "missing" as BookingId, roomLayout: "Theatre" }),
    ).rejects.toThrow(BookingNotFoundError);
  });

  it("refuses to change the layout of a booking Venue Staff have already confirmed", async () => {
    const { useCase, bookings, booking } = await build("Theatre", "Confirmed");

    await expect(
      useCase.execute({ bookingId: booking.id, roomLayout: "Boardroom" }),
    ).rejects.toThrow(BookingRoomLayoutNotChangeableError);
    expect((await bookings.find(booking.id))?.roomLayout).toBe("Theatre");
  });
});
