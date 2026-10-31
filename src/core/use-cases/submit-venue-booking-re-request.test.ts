import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueStaffDirectory } from "@/adapters/outbound/in-memory/in-memory-venue-staff-directory";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";

import type { BookingId } from "../domain/booking";
import {
  CoordinatorEventNotFoundError,
  NoFlagToReRequestError,
  ReRequestPendingError,
  VenueSlotUnavailableError,
} from "../domain/errors";
import { venueId, type Venue } from "../domain/venue";
import type { EventBookingFlag } from "../ports/outbound/booking-flag-repository";
import { SubmitVenueBookingRequestUseCase } from "./submit-venue-booking-request";

const COORDINATOR = "coordinator-1";
const NOW = new Date("2026-10-26T09:00:00+08:00");

const EVENT: SeedCoordinatorEvent = {
  id: "event-1",
  eventRequestId: "request-1",
  name: "Tech Summit",
  clientOrganisationName: "Sunrise Events Co",
  preferredDate: "2026-11-16",
  status: "Planning",
  assignedCoordinatorUserAccountId: COORDINATOR,
  description: null,
  expectedAttendance: 110,
  clientOrganisationId: "org-1",
  owningOrganiserUserAccountId: "organiser-1",
};

function venue(id: string, location: string): Venue {
  return {
    id: venueId(id),
    location,
    capacity: 200,
    facilities: null,
    accessibility: null,
    openingHours: [{ start: "00:00", end: "24:00" }],
    bookingHorizonDays: null,
    layouts: [{ name: "Theatre", capacity: 200 }],
  };
}

const HALL = venue("venue-hall", "Main Hall");
const STUDIO = venue("venue-studio", "Studio");

/** The flagged booking: Main Hall, 13:00 to 18:00 on 16 November, Confirmed. */
const FLAGGED: StoredBooking = {
  id: "booking-1",
  eventId: "event-1",
  venueId: "venue-hall",
  venueLocation: "Main Hall",
  roomLayoutName: "Theatre",
  status: "Confirmed",
  times: [{ date: "2026-11-16", start: "13:00", end: "18:00" }],
  requestedBy: COORDINATOR,
  requestedAt: "2026-10-01T00:00:00.000Z",
};

function flagOn(booking: StoredBooking): EventBookingFlag {
  return {
    flagId: `flag-${booking.id}`,
    bookingId: booking.id as BookingId,
    venueLocation: booking.venueLocation,
    status: booking.status,
    holdExpiresAt: null,
    bookedFor: "2026-11-16 13:00 to 18:00",
    reasonCode: "venue-unavailable",
    detail: "Maintenance: 2026-11-16 13:00 to 18:00",
    flaggedAt: "2026-10-25T00:00:00.000Z",
    sourceLiftedAt: null,
  };
}

function build(stored: readonly StoredBooking[] = [FLAGGED], flags: readonly EventBookingFlag[] = [flagOn(FLAGGED)]) {
  const bookings = new InMemoryBookingRepository(stored, new Map([["venue-hall", "Main Hall"], ["venue-studio", "Studio"]]));
  const notifier = new RecordingNotifier();
  const useCase = new SubmitVenueBookingRequestUseCase({
    events: new InMemoryCoordinatorEventRepository([EVENT]),
    venues: new InMemoryVenueCatalogue([HALL, STUDIO]),
    bookings,
    flags: { openForEvent: async () => flags },
    venueStaff: new InMemoryVenueStaffDirectory(["venue-staff-1"]),
    notifier,
    clock: new FixedClock(NOW),
  });
  return { useCase, bookings, notifier };
}

function reRequest(overrides: { venueId?: string; userAccountId?: string; start?: string; end?: string } = {}) {
  return {
    eventId: "event-1",
    userAccountId: overrides.userAccountId ?? COORDINATOR,
    venueId: overrides.venueId ?? "venue-studio",
    roomLayout: "Theatre",
    times: [{ date: "2026-11-16", start: overrides.start ?? "13:00", end: overrides.end ?? "18:00" }],
    replacesBookingId: "booking-1",
  };
}

describe("SubmitVenueBookingRequestUseCase re-requesting a flagged booking (SPM-251)", () => {
  it("AC3, AC4: sends an ordinary request for another venue that names the booking it replaces", async () => {
    const { useCase, bookings, notifier } = build();

    const result = await useCase.execute(reRequest());

    expect(result).toEqual({
      bookingId: "booking-2",
      status: "Requested",
      venueLocation: "Studio",
      replacingVenueLocation: "Main Hall",
    });
    expect(bookings.all()[1]).toMatchObject({ status: "Requested", venueId: "venue-studio", replacesBookingId: "booking-1" });
    // The flagged booking keeps its status until Venue Staff approve.
    expect(bookings.all()[0]?.status).toBe("Confirmed");
    expect(notifier.bookingRequests).toHaveLength(1);
  });

  it("AC3, AC5: the same venue at an overlapping time does not clash with the booking it replaces", async () => {
    const { useCase, bookings } = build();

    await useCase.execute(reRequest({ venueId: "venue-hall", start: "14:00", end: "19:00" }));

    expect(bookings.all()[1]).toMatchObject({ venueId: "venue-hall", replacesBookingId: "booking-1" });
  });

  it("AC5: another booking at that venue still clashes", async () => {
    const other: StoredBooking = { ...FLAGGED, id: "booking-9", eventId: "event-other", times: [{ date: "2026-11-16", start: "18:45", end: "20:00" }] };
    const { useCase, bookings } = build([FLAGGED, other]);

    await expect(useCase.execute(reRequest({ venueId: "venue-hall", start: "14:00", end: "19:00" }))).rejects.toBeInstanceOf(
      VenueSlotUnavailableError,
    );
    expect(bookings.all()).toHaveLength(2);
  });

  it("AC1: a booking with no open flag is refused, and nothing is saved or sent", async () => {
    const { useCase, bookings, notifier } = build([FLAGGED], []);

    await expect(useCase.execute(reRequest())).rejects.toBeInstanceOf(NoFlagToReRequestError);
    expect(bookings.all()).toHaveLength(1);
    expect(notifier.bookingRequests).toHaveLength(0);
  });

  it("AC1: another coordinator is told the event does not exist", async () => {
    const { useCase } = build();

    await expect(useCase.execute(reRequest({ userAccountId: "coordinator-2" }))).rejects.toBeInstanceOf(
      CoordinatorEventNotFoundError,
    );
  });

  it("AC9: a second re-request is refused while the first waits for Venue Staff", async () => {
    const { useCase, bookings } = build();
    await useCase.execute(reRequest());

    await expect(useCase.execute(reRequest({ venueId: "venue-hall" }))).rejects.toBeInstanceOf(ReRequestPendingError);
    expect(bookings.all()).toHaveLength(2);
  });

  it("AC9: two re-requests sent at once save only one", async () => {
    const { useCase, bookings } = build();

    const results = await Promise.allSettled([useCase.execute(reRequest()), useCase.execute(reRequest({ venueId: "venue-hall" }))]);

    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.any(ReRequestPendingError) });
    expect(bookings.all().filter((booking) => booking.replacesBookingId === "booking-1")).toHaveLength(1);
  });

  it("AC7: once the re-request is rejected the booking can be re-requested again", async () => {
    const rejected: StoredBooking = { ...FLAGGED, id: "booking-2", venueId: "venue-studio", status: "Rejected", replacesBookingId: "booking-1" };
    const { useCase, bookings } = build([FLAGGED, rejected]);

    await useCase.execute(reRequest({ venueId: "venue-hall" }));

    expect(bookings.all()).toHaveLength(3);
  });
});
