import { describe, expect, it } from "vitest";

import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import { RoomLayoutRequiredError, UnsupportedRoomLayoutError, VenueNotFoundError } from "../domain/errors";
import { venueId, type Venue } from "../domain/venue";
import { RequestVenueBookingUseCase } from "./request-venue-booking";

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

function build() {
  const bookings = new InMemoryBookingRepository();
  const useCase = new RequestVenueBookingUseCase({
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings,
  });
  return { useCase, bookings };
}

describe("RequestVenueBookingUseCase (SPM-104)", () => {
  it("records the chosen layout on the booking as a reference to a supported layout", async () => {
    const { useCase, bookings } = build();

    const booking = await useCase.execute({ eventId: "e1", venueId: "v1", roomLayout: "Boardroom" });

    expect(booking.roomLayout).toBe("Boardroom");
    expect(booking.status).toBe("Requested");
    expect(await bookings.find(booking.id)).toEqual(booking);
  });

  it("stores nothing when no layout is given", async () => {
    const { useCase, bookings } = build();

    await expect(
      useCase.execute({ eventId: "e1", venueId: "v1", roomLayout: null }),
    ).rejects.toThrow(RoomLayoutRequiredError);
    expect(bookings.all()).toHaveLength(0);
  });

  it("stores nothing when the layout is not one the venue supports", async () => {
    const { useCase, bookings } = build();

    await expect(
      useCase.execute({ eventId: "e1", venueId: "v1", roomLayout: "Banquet" }),
    ).rejects.toThrow(UnsupportedRoomLayoutError);
    expect(bookings.all()).toHaveLength(0);
  });

  it("refuses a venue that is not in the catalogue", async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ eventId: "e1", venueId: "nope", roomLayout: "Theatre" }),
    ).rejects.toThrow(VenueNotFoundError);
  });
});
