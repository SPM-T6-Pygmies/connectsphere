import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueUnavailabilityRepository } from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";

import { InvalidCalendarRangeError, VenueNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { venueId, type Venue } from "../domain/venue";
import type { CalendarSlotStatus } from "../domain/venue-calendar";
import { ViewVenueCalendarUseCase, type VenueCalendar } from "./view-venue-calendar";

// 2 Nov 2026, 00:30 in Singapore -- still 1 Nov in UTC.
const NOW = new Date("2026-11-01T16:30:00Z");
const STAFF = userAccountId("9");

const HALL: Venue = {
  id: venueId("5"),
  location: "Harbour Hall",
  facilities: null,
  accessibility: null,
  slots: ["AM", "PM", "Night"],
  capacity: 200,
  bookingHorizonDays: 90,
  layouts: [],
};

function booking(overrides: Partial<StoredBooking>): StoredBooking {
  return {
    id: "1",
    eventId: "1",
    venueId: "5",
    venueLocation: "Harbour Hall",
    roomLayoutName: null,
    status: "Confirmed",
    slots: [],
    requestedAt: NOW.toISOString(),
    requestedBy: "2",
    ...overrides,
  };
}

function build(bookings: StoredBooking[] = []) {
  const clock = new FixedClock(NOW);
  const blocks = new InMemoryVenueUnavailabilityRepository(clock);
  const useCase = new ViewVenueCalendarUseCase({
    venues: new InMemoryVenueCatalogue([HALL]),
    bookings: new InMemoryBookingRepository(bookings),
    blocks,
    clock,
    timeZone: "Asia/Singapore",
  });
  return { useCase, blocks };
}

function statusOn(calendar: VenueCalendar, date: string, slot: "AM" | "PM" | "Night"): CalendarSlotStatus {
  const day = calendar.days.find((d) => d.date === date);
  const found = day?.slots.find((s) => s.slot === slot);
  if (found === undefined) {
    throw new Error(`No ${slot} on ${date} in the calendar.`);
  }
  return found.status;
}

describe("ViewVenueCalendarUseCase (SPM-154)", () => {
  it("shows one week from the date asked for", async () => {
    const calendar = await build().useCase.execute({ venueId: "5", from: "2026-11-10" });

    expect(calendar.from).toBe("2026-11-10");
    expect(calendar.to).toBe("2026-11-16");
    expect(calendar.days.map((d) => d.date)).toHaveLength(7);
  });

  it("starts on today in Singapore when no date is given", async () => {
    const calendar = await build().useCase.execute({ venueId: "5", from: null });

    expect(calendar.from).toBe("2026-11-02");
  });

  it("shows the venue's bookings and blocks together", async () => {
    const { useCase, blocks } = build([
      booking({ slots: [{ date: "2026-11-03", slot: "AM" }] }),
      booking({
        id: "2",
        status: "Tentative Hold",
        holdExpiresAt: new Date("2026-11-05T12:00:00+08:00"),
        slots: [{ date: "2026-11-03", slot: "PM" }],
      }),
    ]);
    await blocks.record(
      {
        venueId: HALL.id,
        startDate: "2026-11-04",
        endDate: "2026-11-04",
        reason: "Safety",
        note: null,
        slots: [{ date: "2026-11-04", slot: "Night" }],
      },
      STAFF,
    );

    const calendar = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(calendar, "2026-11-03", "AM")).toBe("booked");
    expect(statusOn(calendar, "2026-11-03", "PM")).toBe("held");
    expect(statusOn(calendar, "2026-11-04", "Night")).toBe("blocked");
    expect(calendar.days[2].slots[2].reasons).toEqual(["Safety"]);
    expect(statusOn(calendar, "2026-11-02", "AM")).toBe("available");
  });

  it("ignores another venue's bookings", async () => {
    const { useCase } = build([booking({ venueId: "6", slots: [{ date: "2026-11-03", slot: "AM" }] })]);

    const calendar = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(calendar, "2026-11-03", "AM")).toBe("available");
  });

  it("refuses a venue that is not in the catalogue", async () => {
    await expect(build().useCase.execute({ venueId: "404", from: null })).rejects.toBeInstanceOf(
      VenueNotFoundError,
    );
  });

  it("refuses a start that is not a date", async () => {
    await expect(
      build().useCase.execute({ venueId: "5", from: "2026-13-01" }),
    ).rejects.toBeInstanceOf(InvalidCalendarRangeError);
  });
});

describe("ViewVenueCalendarUseCase reads live (SPM-43)", () => {
  it("shows a block recorded after the last read on the next read, with no refresh step", async () => {
    const { useCase, blocks } = build();
    const before = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    const recorded = await blocks.record(
      {
        venueId: HALL.id,
        startDate: "2026-11-02",
        endDate: "2026-11-02",
        reason: "Maintenance",
        note: null,
        slots: [{ date: "2026-11-02", slot: "AM" }],
      },
      STAFF,
    );
    const after = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(before, "2026-11-02", "AM")).toBe("available");
    expect(statusOn(after, "2026-11-02", "AM")).toBe("blocked");

    await blocks.lift({ id: recorded.id, liftedBy: STAFF, liftedAt: NOW });
    const lifted = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(lifted, "2026-11-02", "AM")).toBe("available");
  });
});
