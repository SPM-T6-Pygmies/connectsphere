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
import type { CalendarPeriod, CalendarPeriodStatus } from "../domain/venue-calendar";
import { ViewVenueCalendarUseCase, type VenueCalendar } from "./view-venue-calendar";

// 2 Nov 2026, 00:30 in Singapore -- still 1 Nov in UTC.
const NOW = new Date("2026-11-01T16:30:00Z");
const STAFF = userAccountId("9");

const HALL: Venue = {
  id: venueId("5"),
  location: "Harbour Hall",
  facilities: null,
  accessibility: null,
  openingHours: [{ start: "07:00", end: "12:00" }, { start: "13:00", end: "18:00" }, { start: "19:00", end: "24:00" }],
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
    times: [],
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

function periodOn(calendar: VenueCalendar, date: string, start: string): CalendarPeriod {
  const day = calendar.days.find((d) => d.date === date);
  const found = day?.periods.find((p) => p.start === start);
  if (found === undefined) {
    throw new Error(`No period starting ${start} on ${date} in the calendar.`);
  }
  return found;
}

function statusOn(calendar: VenueCalendar, date: string, start: string): CalendarPeriodStatus {
  return periodOn(calendar, date, start).status;
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
      booking({ times: [{ date: "2026-11-03", start: "07:00", end: "12:00" }] }),
      booking({
        id: "2",
        status: "Tentative Hold",
        holdExpiresAt: new Date("2026-11-05T12:00:00+08:00"),
        times: [{ date: "2026-11-03", start: "13:00", end: "18:00" }],
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

    expect(statusOn(calendar, "2026-11-03", "07:00")).toBe("confirmed");
    expect(statusOn(calendar, "2026-11-03", "13:00")).toBe("held");
    expect(statusOn(calendar, "2026-11-04", "19:00")).toBe("blocked");
    expect(periodOn(calendar, "2026-11-04", "19:00").reasons).toEqual(["Safety"]);
    expect(statusOn(calendar, "2026-11-02", "07:00")).toBe("available");
  });

  it("ignores another venue's bookings", async () => {
    const { useCase } = build([booking({ venueId: "6", times: [{ date: "2026-11-03", start: "07:00", end: "12:00" }] })]);

    const calendar = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(calendar, "2026-11-03", "07:00")).toBe("available");
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

describe("ViewVenueCalendarUseCase block notes (SPM-43)", () => {
  it("shows the note Venue Staff wrote on an Other block", async () => {
    const { useCase, blocks } = build();
    await blocks.record(
      {
        venueId: HALL.id,
        startDate: "2026-11-03",
        endDate: "2026-11-03",
        reason: "Other",
        note: "Terrace closed for resurfacing",
        slots: [{ date: "2026-11-03", slot: "PM" }],
      },
      STAFF,
    );

    const calendar = await useCase.execute({ venueId: "5", from: "2026-11-02" });
    const pm = periodOn(calendar, "2026-11-03", "13:00");

    expect(pm.reasons).toEqual(["Other"]);
    expect(pm.notes).toEqual(["Terrace closed for resurfacing"]);
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

    expect(statusOn(before, "2026-11-02", "07:00")).toBe("available");
    expect(statusOn(after, "2026-11-02", "07:00")).toBe("blocked");

    await blocks.lift({ id: recorded.id, liftedBy: STAFF, liftedAt: NOW });
    const lifted = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(lifted, "2026-11-02", "07:00")).toBe("available");
  });
});

describe("ViewVenueCalendarUseCase on the 15-minute grid (SPM-323)", () => {
  it("shows a Confirmed 10:15-11:45 booking on exactly its periods (AC2)", async () => {
    const { useCase } = build([booking({ times: [{ date: "2026-11-03", start: "10:15", end: "11:45" }] })]);

    const calendar = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(calendar, "2026-11-03", "10:00")).toBe("available");
    expect(statusOn(calendar, "2026-11-03", "10:15")).toBe("confirmed");
    expect(statusOn(calendar, "2026-11-03", "11:30")).toBe("confirmed");
    expect(statusOn(calendar, "2026-11-03", "11:45")).toBe("available");
  });

  it("shows a block on 15-minute codes, with its reason, on the next read after it is recorded (AC3, AC4)", async () => {
    const { useCase, blocks } = build();
    const before = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    await blocks.record(
      {
        venueId: HALL.id,
        startDate: "2026-11-02",
        endDate: "2026-11-02",
        reason: "Safety",
        note: null,
        // 09:00-09:30
        slots: [
          { date: "2026-11-02", slot: "36" },
          { date: "2026-11-02", slot: "37" },
        ],
      },
      STAFF,
    );
    const after = await useCase.execute({ venueId: "5", from: "2026-11-02" });

    expect(statusOn(before, "2026-11-02", "09:00")).toBe("available");
    expect(periodOn(after, "2026-11-02", "09:15")).toMatchObject({ status: "blocked", reasons: ["Safety"] });
    expect(statusOn(after, "2026-11-02", "09:30")).toBe("available");
  });
});
