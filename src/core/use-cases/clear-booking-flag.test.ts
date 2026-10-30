import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import {
  InMemoryVenueUnavailabilityRepository,
  type SeededBooking,
} from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";

import { CoordinatorEventNotFoundError, NoFlagToClearError } from "../domain/errors";
import { slotCodesFor } from "../domain/slot-grid";
import { toMinutes } from "../domain/time-of-day";
import { userAccountId } from "../domain/user-account";
import { venueId } from "../domain/venue";
import type { UnavailabilityReason, VenueUnavailabilityBlock } from "../domain/venue-unavailability";
import { ClearBookingFlagUseCase } from "./clear-booking-flag";

/** The 15-minute slots from `start` to `end` on `date`, as the slot tables hold them (SPM-331). */
function slotsOf(date: string, start: string, end: string) {
  return slotCodesFor({ start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 }).map((slot) => ({ date, slot }));
}

const COORDINATOR = "coordinator-1";
const OTHER_COORDINATOR = "coordinator-2";
const STAFF = userAccountId("staff-1");
const NOW = new Date("2026-10-21T10:00:00+08:00");

const EVENT: SeedCoordinatorEvent = {
  id: "event-1",
  eventRequestId: "request-1",
  name: "Tech Summit",
  clientOrganisationName: "Sunrise Events Co",
  preferredDate: "2026-11-06",
  status: "Planning",
  assignedCoordinatorUserAccountId: COORDINATOR,
  description: null,
  expectedAttendance: 110,
  clientOrganisationId: "org-1",
  owningOrganiserUserAccountId: "organiser-1",
};

function booking(id: string, venue: string, overrides: Partial<SeededBooking> = {}): SeededBooking {
  return {
    id,
    venueId: venue,
    eventName: "Tech Summit",
    status: "Confirmed",
    slots: slotsOf("2026-11-06", "13:00", "18:00"),
    eventId: "event-1",
    coordinatorUserAccountId: COORDINATOR,
    ...overrides,
  };
}

function block(venue: string, reason: UnavailabilityReason = "Maintenance"): VenueUnavailabilityBlock {
  return {
    venueId: venueId(venue),
    startDate: "2026-11-06",
    endDate: "2026-11-06",
    slots: slotsOf("2026-11-06", "13:00", "18:00"),
    reason,
    note: null,
  };
}

/** booking-1 at Main Hall carries two reasons; booking-2 at Studio carries one; booking-3 none. */
async function build() {
  const flags = new InMemoryVenueUnavailabilityRepository(
    new FixedClock(NOW),
    new Map([
      ["venue-1", "Main Hall"],
      ["venue-2", "Studio"],
      ["venue-3", "Rooftop Terrace"],
    ]),
    new Map(),
    [booking("booking-1", "venue-1"), booking("booking-2", "venue-2"), booking("booking-3", "venue-3")],
  );
  await flags.record(block("venue-1"), STAFF);
  await flags.record(block("venue-1", "Safety"), STAFF);
  await flags.record(block("venue-2"), STAFF);
  const useCase = new ClearBookingFlagUseCase({
    events: new InMemoryCoordinatorEventRepository([EVENT]),
    flags,
  });
  return { flags, useCase };
}

const CLEAR = { eventId: "event-1", bookingId: "booking-1", userAccountId: COORDINATOR };

describe("ClearBookingFlagUseCase (SPM-310)", () => {
  it("AC1: clears every reason on the booking and leaves its status as it was", async () => {
    const { flags, useCase } = await build();

    const result = await useCase.execute(CLEAR);

    expect(result).toEqual({
      bookingId: "booking-1",
      venueLocation: "Main Hall",
      status: "Confirmed",
      reasonsCleared: 2,
    });
    const open = await flags.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(open.some(({ bookingId }) => bookingId === "booking-1")).toBe(false);
    expect(flags.seededBookings().find(({ id }) => id === "booking-1")?.status).toBe("Confirmed");
  });

  it("AC2: keeps each cleared reason, with who cleared it, when, and how", async () => {
    const { flags, useCase } = await build();

    await useCase.execute(CLEAR);

    expect(flags.clearedFlags()).toEqual([
      {
        bookingId: "booking-1",
        reasonCode: "venue-unavailable",
        detail: "Maintenance: 2026-11-06 13:00 to 18:00",
        clearedAt: NOW.toISOString(),
        clearedBy: COORDINATOR,
        clearedHow: "coordinator",
      },
      {
        bookingId: "booking-1",
        reasonCode: "venue-unavailable",
        detail: "Safety: 2026-11-06 13:00 to 18:00",
        clearedAt: NOW.toISOString(),
        clearedBy: COORDINATOR,
        clearedHow: "coordinator",
      },
    ]);
  });

  it("AC3: tells another coordinator the event does not exist, and clears nothing", async () => {
    const { flags, useCase } = await build();

    await expect(useCase.execute({ ...CLEAR, userAccountId: OTHER_COORDINATOR })).rejects.toThrow(
      CoordinatorEventNotFoundError,
    );
    expect(flags.clearedFlags()).toEqual([]);
  });

  it("AC3: tells Venue Staff the event does not exist, and clears nothing", async () => {
    const { flags, useCase } = await build();

    await expect(useCase.execute({ ...CLEAR, userAccountId: STAFF })).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(flags.clearedFlags()).toEqual([]);
  });

  it("AC4: leaves the flag on the event's other booking open", async () => {
    const { flags, useCase } = await build();

    await useCase.execute(CLEAR);

    const open = await flags.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(open.map(({ bookingId, detail }) => [bookingId, detail])).toEqual([
      ["booking-2", "Maintenance: 2026-11-06 13:00 to 18:00"],
    ]);
  });

  it("AC5: flags the booking again when a later block covers it, with only the new reason", async () => {
    const { flags, useCase } = await build();
    await useCase.execute(CLEAR);

    await flags.record(block("venue-1", "Renovation"), STAFF);

    const open = await flags.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(open.filter(({ bookingId }) => bookingId === "booking-1").map(({ detail }) => detail)).toEqual([
      "Renovation: 2026-11-06 13:00 to 18:00",
    ]);
  });

  it("AC6: refuses a booking that is not flagged", async () => {
    const { useCase } = await build();

    await expect(useCase.execute({ ...CLEAR, bookingId: "booking-3" })).rejects.toThrow(NoFlagToClearError);
  });

  it("AC6: refuses clearing the same booking twice, and records the first clear only", async () => {
    const { flags, useCase } = await build();
    await useCase.execute(CLEAR);

    await expect(useCase.execute(CLEAR)).rejects.toThrow("This booking has no open flag to clear.");
    expect(flags.clearedFlags()).toHaveLength(2);
  });
});
