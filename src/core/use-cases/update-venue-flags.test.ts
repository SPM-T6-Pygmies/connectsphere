import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueChangeReview } from "@/adapters/outbound/in-memory/in-memory-venue-change-review";

import { VenueMaintenanceNotPermittedError, VenueNotFoundError } from "../domain/errors";
import { venueId, type Venue } from "../domain/venue";
import type { VenueChangeBooking } from "../domain/venue-change-flag";
import { UpdateVenueUseCase, type UpdateVenueCommand } from "./update-venue";

const MAIN_HALL: Venue = {
  id: venueId("5"),
  location: "Main Hall",
  facilities: "Wi-Fi, Catering area",
  accessibility: "Step-free access",
  openingHours: [{ start: "08:00", end: "22:00" }],
  capacity: 300,
  bookingHorizonDays: 180,
  layouts: [
    { name: "Theatre", capacity: 300 },
    { name: "Banquet", capacity: 150 },
  ],
};

const GALA: VenueChangeBooking = {
  id: "812",
  status: "Confirmed",
  holdExpiresAt: null,
  slots: [{ date: "2026-11-16", slot: "76" }],
  roomLayoutName: "Banquet",
  needs: { expectedAttendance: 120, preferredLayout: "Banquet", accessibilityNeeds: null, requiredFacilities: null },
};

function build() {
  const venues = new InMemoryVenueCatalogue([MAIN_HALL]);
  const review = new InMemoryVenueChangeReview(new Map([[MAIN_HALL.id, [GALA]]]));
  const update = new UpdateVenueUseCase({
    venues,
    review,
    clock: new FixedClock(new Date("2026-10-23T10:00:00+08:00")),
  });
  return { venues, review, update };
}

function banquetSeats(capacity: number, overrides: Partial<UpdateVenueCommand> = {}): UpdateVenueCommand {
  return {
    roles: ["Venue Staff"],
    venueId: MAIN_HALL.id,
    location: MAIN_HALL.location,
    facilities: MAIN_HALL.facilities,
    accessibility: MAIN_HALL.accessibility,
    openingHours: MAIN_HALL.openingHours,
    capacity: MAIN_HALL.capacity,
    bookingHorizonDays: MAIN_HALL.bookingHorizonDays,
    setupMinutes: MAIN_HALL.setupMinutes ?? null,
    turnaroundMinutes: MAIN_HALL.turnaroundMinutes ?? null,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Banquet", capacity },
    ],
    ...overrides,
  };
}

describe("UpdateVenueUseCase flags the bookings an edit breaks (SPM-105)", () => {
  it("AC1: saving a capacity cut flags the booking it no longer fits, and saves the venue", async () => {
    const { venues, review, update } = build();

    await update.execute(banquetSeats(80));

    expect(review.all()).toEqual([
      { bookingId: "812", sourceRef: "capacity:Banquet", detail: "Capacity: Banquet seats 80, 40 over", cleared: false },
    ]);
    expect((await venues.find(MAIN_HALL.id))?.layouts).toContainEqual({ name: "Banquet", capacity: 80 });
  });

  it("AC2: a cut the booking still fits flags nothing", async () => {
    const { review, update } = build();

    await update.execute(banquetSeats(120));

    expect(review.all()).toEqual([]);
  });

  it("AC8: cutting the same layout again leaves one reason, restated", async () => {
    const { review, update } = build();

    await update.execute(banquetSeats(80));
    await update.execute(banquetSeats(70));

    expect(review.all()).toEqual([
      { bookingId: "812", sourceRef: "capacity:Banquet", detail: "Capacity: Banquet seats 70, 50 over", cleared: false },
    ]);
  });

  it("AC8: a reason the coordinator cleared is not reopened by a further cut", async () => {
    const { review, update } = build();

    await update.execute(banquetSeats(80));
    review.clear("812");
    await update.execute(banquetSeats(70));

    expect(review.all()).toEqual([
      { bookingId: "812", sourceRef: "capacity:Banquet", detail: "Capacity: Banquet seats 80, 40 over", cleared: true },
    ]);
  });

  it("flags nothing when the edit is refused: not Venue Staff, or no such venue", async () => {
    const { review, update } = build();

    await expect(update.execute(banquetSeats(80, { roles: [] }))).rejects.toThrow(VenueMaintenanceNotPermittedError);
    await expect(update.execute(banquetSeats(80, { venueId: "99" }))).rejects.toThrow(VenueNotFoundError);
    expect(review.all()).toEqual([]);
  });
});
