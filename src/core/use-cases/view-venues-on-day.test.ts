import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueUnavailabilityRepository } from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";

import { InvalidCalendarRangeError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { venueId, type Venue } from "../domain/venue";
import type { CalendarPeriodStatus } from "../domain/venue-calendar";
import { ViewVenuesOnDayUseCase, type VenuesOnDay } from "./view-venues-on-day";

// 2 Nov 2026, 00:30 in Singapore -- still 1 Nov in UTC.
const NOW = new Date("2026-11-01T16:30:00Z");
const STAFF = userAccountId("9");

function venue(id: string, location: string, openingHours: Venue["openingHours"]): Venue {
  return {
    id: venueId(id),
    location,
    facilities: null,
    accessibility: null,
    openingHours,
    capacity: 100,
    bookingHorizonDays: 90,
    layouts: [],
  };
}

const HARBOUR = venue("5", "Harbour Hall", [{ start: "07:00", end: "24:00" }]);
const GARDEN = venue("6", "Garden Room", [{ start: "07:00", end: "18:00" }]);
const ANNEX = venue("7", "Annex", []);

function booking(overrides: Partial<StoredBooking>): StoredBooking {
  return {
    id: "1",
    eventId: "1",
    venueId: "5",
    venueLocation: "Harbour Hall",
    roomLayoutName: null,
    status: "Confirmed",
    times: [],
    requestedAt: NOW.toISOString(),
    requestedBy: "2",
    ...overrides,
  };
}

function build(bookings: StoredBooking[] = []) {
  const clock = new FixedClock(NOW);
  const blocks = new InMemoryVenueUnavailabilityRepository(clock);
  const useCase = new ViewVenuesOnDayUseCase({
    venues: new InMemoryVenueCatalogue([HARBOUR, GARDEN, ANNEX]),
    bookings: new InMemoryBookingRepository(bookings),
    blocks,
    clock,
    timeZone: "Asia/Singapore",
  });
  return { useCase, blocks };
}

function statusAt(day: VenuesOnDay, location: string, start: string): CalendarPeriodStatus | undefined {
  return day.venues.find((v) => v.venue.location === location)?.periods.find((p) => p.start === start)?.status;
}

describe("ViewVenuesOnDayUseCase (SPM-323)", () => {
  it("shows every venue in the catalogue on the day asked for", async () => {
    const day = await build().useCase.execute({ date: "2026-11-10" });

    expect(day.date).toBe("2026-11-10");
    expect(day.venues.map((v) => v.venue.location)).toEqual(["Annex", "Garden Room", "Harbour Hall"]);
  });

  it("shows today in Singapore when no date is given", async () => {
    expect((await build().useCase.execute({ date: null })).date).toBe("2026-11-02");
  });

  it("gives each venue its own opening hours, closed after them (AC1)", async () => {
    const day = await build().useCase.execute({ date: "2026-11-02" });

    expect(statusAt(day, "Harbour Hall", "18:00")).toBe("available");
    expect(statusAt(day, "Garden Room", "17:45")).toBe("available");
    expect(statusAt(day, "Garden Room", "18:00")).toBeUndefined();
  });

  it("shows exactly the periods a booking takes, at its own venue only (AC2)", async () => {
    const { useCase } = build([booking({ times: [{ date: "2026-11-02", start: "10:15", end: "11:45" }] })]);

    const day = await useCase.execute({ date: "2026-11-02" });

    expect(statusAt(day, "Harbour Hall", "10:00")).toBe("available");
    expect(statusAt(day, "Harbour Hall", "10:15")).toBe("confirmed");
    expect(statusAt(day, "Harbour Hall", "11:30")).toBe("confirmed");
    expect(statusAt(day, "Harbour Hall", "11:45")).toBe("available");
    expect(statusAt(day, "Garden Room", "10:15")).toBe("available");
  });

  it("leaves out a booking on another day", async () => {
    const { useCase } = build([booking({ times: [{ date: "2026-11-03", start: "10:00", end: "11:00" }] })]);

    expect(statusAt(await useCase.execute({ date: "2026-11-02" }), "Harbour Hall", "10:00")).toBe("available");
  });

  it("shows a block with its reason on the next read after it is recorded (AC3, AC4)", async () => {
    const { useCase, blocks } = build();
    const before = await useCase.execute({ date: "2026-11-02" });

    await blocks.record(
      {
        venueId: GARDEN.id,
        startDate: "2026-11-02",
        endDate: "2026-11-02",
        reason: "Renovation",
        note: null,
        // 09:00-09:15
        slots: [{ date: "2026-11-02", slot: "36" }],
      },
      STAFF,
    );
    const after = await useCase.execute({ date: "2026-11-02" });

    expect(statusAt(before, "Garden Room", "09:00")).toBe("available");
    expect(after.venues.find((v) => v.venue.id === GARDEN.id)?.periods.find((p) => p.start === "09:00")).toMatchObject(
      { status: "blocked", reasons: ["Renovation"] },
    );
  });

  it("lists a venue with no opening hours and nothing on it, with no periods", async () => {
    const day = await build().useCase.execute({ date: "2026-11-02" });

    expect(day.venues.find((v) => v.venue.id === ANNEX.id)?.periods).toEqual([]);
  });

  it("refuses a date that is not a date", async () => {
    await expect(build().useCase.execute({ date: "2026-02-30" })).rejects.toBeInstanceOf(InvalidCalendarRangeError);
  });
});
