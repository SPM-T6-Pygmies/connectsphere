import { describe, expect, it } from "vitest";

import {
  InMemoryBookingRepository,
  type StoredBooking,
} from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueStaffDirectory } from "@/adapters/outbound/in-memory/in-memory-venue-staff-directory";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import {
  CancelledEventBookingError,
  CoordinatorEventNotFoundError,
  RoomLayoutRequiredError,
  VenueNotFoundError,
  VenueSlotUnavailableError,
} from "@/core/domain/errors";
import { slotTime } from "@/core/domain/booking";
import { venueId, type Venue } from "@/core/domain/venue";

import { SubmitVenueBookingRequestUseCase } from "./submit-venue-booking-request";

const COORDINATOR = "coordinator-1";
const OTHER_COORDINATOR = "coordinator-2";

const EVENT: SeedCoordinatorEvent = {
  id: "event-1",
  eventRequestId: "request-1",
  name: "Annual Conference",
  clientOrganisationName: "Acme",
  preferredDate: "2026-10-05",
  status: "Planning",
  assignedCoordinatorUserAccountId: COORDINATOR,
  description: null,
  expectedAttendance: null,
  clientOrganisationId: "org-1",
  owningOrganiserUserAccountId: "organiser-1",
};

const CANCELLED_EVENT: SeedCoordinatorEvent = { ...EVENT, id: "event-cancelled", status: "Cancelled" };

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 300,
  facilities: null,
  accessibility: null,
  openingHours: [{ start: "00:00", end: "24:00" }],
  bookingHorizonDays: null,
  layouts: [
    { name: "Theatre", capacity: 300 },
    { name: "Banquet", capacity: 180 },
  ],
};

const STUDIO: Venue = {
  id: venueId("venue-studio"),
  location: "Studio",
  capacity: 40,
  facilities: null,
  accessibility: null,
  openingHours: [{ start: "00:00", end: "24:00" }],
  bookingHorizonDays: null,
  layouts: [{ name: "Classroom", capacity: 40 }],
};

function confirmedAt(venue: string, date: string, slot: "AM" | "PM" | "Night"): StoredBooking {
  return {
    id: "existing-1",
    eventId: "event-other",
    venueId: venue,
    venueLocation: venue,
    roomLayoutName: null,
    status: "Confirmed",
    times: [slotTime({ date, slot })],
    requestedBy: OTHER_COORDINATOR,
    requestedAt: "2026-09-20T00:00:00.000Z",
  };
}

const NOW = new Date("2026-10-01T09:00:00+08:00");

function heldAt(venue: string, slot: "AM" | "PM" | "Night", holdExpiresAt: Date | null): StoredBooking {
  return { ...confirmedAt(venue, "2026-10-05", slot), status: "Tentative Hold", holdExpiresAt };
}

function buildUseCase(
  existing: readonly StoredBooking[] = [],
  venueStaff: readonly string[] = ["venue-staff-1"],
) {
  const bookings = new InMemoryBookingRepository(existing);
  const notifier = new RecordingNotifier();
  const useCase = new SubmitVenueBookingRequestUseCase({
    events: new InMemoryCoordinatorEventRepository([EVENT, CANCELLED_EVENT]),
    venues: new InMemoryVenueCatalogue([HALL, STUDIO]),
    bookings,
    venueStaff: new InMemoryVenueStaffDirectory(venueStaff),
    notifier,
    clock: new FixedClock(NOW),
  });
  return { useCase, bookings, notifier };
}

describe("SubmitVenueBookingRequestUseCase (SPM-46)", () => {
  it("records the assigned coordinator's request for Venue Staff to review (AC1, AC2)", async () => {
    const { useCase, bookings } = buildUseCase();

    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Banquet",
      slots: [
        { date: "2026-10-05", slot: "PM" },
        { date: "2026-10-05", slot: "AM" },
      ],
    });

    expect(result).toEqual({ bookingId: "booking-1", status: "Requested", venueLocation: "Main Hall" });
    expect(bookings.all()).toEqual([
      expect.objectContaining({
        eventId: "event-1",
        venueId: "venue-hall",
        roomLayoutName: "Banquet",
        status: "Requested",
        requestedBy: COORDINATOR,
        times: [
          { date: "2026-10-05", start: "07:00", end: "12:00" },
          { date: "2026-10-05", start: "13:00", end: "18:00" },
        ],
      }),
    ]);
  });

  it("carries a single-layout venue's layout without asking for it", async () => {
    const { useCase, bookings } = buildUseCase();

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-studio",
      roomLayout: null,
      slots: [{ date: "2026-10-05", slot: "AM" }],
    });

    expect(bookings.all()[0]).toMatchObject({ roomLayoutName: "Classroom" });
  });

  it("refuses a multi-layout venue with no layout chosen, storing nothing (AC2)", async () => {
    const { useCase, bookings } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: null,
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).rejects.toThrow(RoomLayoutRequiredError);
    expect(bookings.all()).toEqual([]);
  });

  it("blocks a slot the venue already has confirmed, storing nothing (AC4)", async () => {
    const { useCase, bookings } = buildUseCase([confirmedAt("venue-hall", "2026-10-05", "PM")]);

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", slot: "PM" }],
      }),
    ).rejects.toThrow(VenueSlotUnavailableError);
    expect(bookings.all()).toHaveLength(1);
  });

  it("does not block on the same slot confirmed at a different venue (AC4)", async () => {
    const { useCase, bookings } = buildUseCase([confirmedAt("venue-studio", "2026-10-05", "PM")]);

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Theatre",
      slots: [{ date: "2026-10-05", slot: "PM" }],
    });

    expect(bookings.all()).toHaveLength(2);
  });

  it("accepts a slot whose only hold expired before now (AC4)", async () => {
    const expired = new Date(NOW.getTime() - 1000);
    const { useCase, bookings } = buildUseCase([heldAt("venue-hall", "PM", expired)]);

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Theatre",
      slots: [{ date: "2026-10-05", slot: "PM" }],
    });

    expect(bookings.all()).toHaveLength(2);
  });

  it("blocks a slot on a hold that has not expired, naming it (AC4)", async () => {
    const live = new Date(NOW.getTime() + 1000);
    const { useCase } = buildUseCase([heldAt("venue-hall", "PM", live)]);

    const error = await useCase
      .execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", slot: "PM" }],
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenueSlotUnavailableError);
    expect((error as VenueSlotUnavailableError).times).toEqual([
      { date: "2026-10-05", start: "13:00", end: "18:00" },
    ]);
  });

  it("does not clash with the same event's own live booking at another venue (AC5)", async () => {
    const { useCase, bookings } = buildUseCase([
      { ...confirmedAt("venue-studio", "2026-10-05", "PM"), eventId: "event-1", requestedBy: COORDINATOR },
    ]);

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Theatre",
      slots: [{ date: "2026-10-05", slot: "PM" }],
    });

    expect(bookings.all()).toHaveLength(2);
  });

  it("answers another coordinator as if the event did not exist (#91)", async () => {
    const { useCase, bookings } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: OTHER_COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(bookings.all()).toEqual([]);
  });

  it("refuses an event that does not exist", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-404",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
  });

  it("refuses a venue that is not in the catalogue", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-404",
        roomLayout: null,
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).rejects.toThrow(VenueNotFoundError);
  });
});

describe("SubmitVenueBookingRequestUseCase (SPM-61)", () => {
  it("AC1, AC2: tells every Venue Staff member the venue, dates and times requested", async () => {
    const { useCase, notifier } = buildUseCase([], ["venue-staff-1", "venue-staff-2"]);

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-hall",
      roomLayout: "Banquet",
      slots: [
        { date: "2026-10-06", slot: "AM" },
        { date: "2026-10-05", slot: "Night" },
      ],
    });

    const expected = {
      bookingId: "booking-1",
      eventName: "Annual Conference",
      venueLocation: "Main Hall",
      times: [
        { date: "2026-10-05", start: "19:00", end: "24:00" },
        { date: "2026-10-06", start: "07:00", end: "12:00" },
      ],
    };
    expect(notifier.bookingRequests).toEqual([
      { recipientUserAccountId: "venue-staff-1", ...expected },
      { recipientUserAccountId: "venue-staff-2", ...expected },
    ]);
  });

  it("AC1: tells no one when the request is refused", async () => {
    const { useCase, notifier } = buildUseCase([confirmedAt("venue-hall", "2026-10-05", "AM")]);

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Banquet",
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).rejects.toBeInstanceOf(VenueSlotUnavailableError);
    expect(notifier.bookingRequests).toEqual([]);
  });

  it("AC1: still records the request when there is no Venue Staff account to tell", async () => {
    const { useCase, bookings, notifier } = buildUseCase([], []);

    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      venueId: "venue-studio",
      roomLayout: null,
      slots: [{ date: "2026-10-05", slot: "AM" }],
    });

    expect(result.status).toBe("Requested");
    expect(bookings.all()).toHaveLength(1);
    expect(notifier.bookingRequests).toEqual([]);
  });
});

describe("SubmitVenueBookingRequestUseCase on a cancelled event (SPM-55)", () => {
  it("AC6: refuses the request, storing nothing and telling no one", async () => {
    const { useCase, bookings, notifier } = buildUseCase();

    await expect(
      useCase.execute({
        eventId: "event-cancelled",
        userAccountId: COORDINATOR,
        venueId: "venue-hall",
        roomLayout: "Theatre",
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).rejects.toThrow(CancelledEventBookingError);
    expect(bookings.all()).toEqual([]);
    expect(notifier.bookingRequests).toEqual([]);
  });
});
