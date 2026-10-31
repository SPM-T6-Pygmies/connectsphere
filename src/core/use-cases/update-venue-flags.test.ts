import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueChangeReview } from "@/adapters/outbound/in-memory/in-memory-venue-change-review";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";

import { VenueMaintenanceNotPermittedError, VenueNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import { venueId, type Venue } from "../domain/venue";
import type { ReviewedBooking } from "../ports/outbound/venue-change-review";
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

const GALA: ReviewedBooking = {
  id: "812",
  eventId: "40",
  eventName: "Harbour Lights Gala",
  coordinatorUserAccountId: "coordinator-1",
  status: "Confirmed",
  holdExpiresAt: null,
  slots: [{ date: "2026-11-16", slot: "76" }],
  roomLayoutName: "Banquet",
  needs: { expectedAttendance: 120, preferredLayout: "Banquet", accessibilityNeeds: null, requiredFacilities: null },
};

function build(bookings: readonly ReviewedBooking[] = [GALA]) {
  const venues = new InMemoryVenueCatalogue([MAIN_HALL]);
  const review = new InMemoryVenueChangeReview(new Map([[MAIN_HALL.id, bookings]]));
  const notifier = new RecordingNotifier();
  const update = new UpdateVenueUseCase({
    venues,
    review,
    clock: new FixedClock(new Date("2026-10-23T10:00:00+08:00")),
    notifier,
  });
  return { venues, review, notifier, update };
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

describe("UpdateVenueUseCase notifies the coordinator (SPM-71)", () => {
  it("AC2, AC3: tells the coordinator of a booking the edit flags, naming the event, the venue and the reason", async () => {
    const { notifier, update } = build();

    await update.execute(banquetSeats(80));

    expect(notifier.bookingsFlagged).toEqual([
      {
        recipientUserAccountId: "coordinator-1",
        bookingId: "812",
        eventId: "40",
        eventName: "Harbour Lights Gala",
        venueLocation: "Main Hall",
        reasonCode: "venue-attributes",
        reasons: ["Capacity: Banquet seats 80, 40 over"],
      },
    ]);
  });

  it("AC4: an edit that breaks two checks on one booking sends one notice listing both", async () => {
    const needsWifi = { ...GALA, needs: { ...GALA.needs, requiredFacilities: "Wi-Fi" } };
    const { notifier, update } = build([needsWifi]);

    await update.execute(banquetSeats(80, { facilities: "Catering area" }));

    expect(notifier.bookingsFlagged.map((notice) => notice.reasons)).toEqual([
      ["Capacity: Banquet seats 80, 40 over", "Facilities: Missing: Wi-Fi"],
    ]);
  });

  it("AC4: one edit over two bookings sends a notice to each booking's coordinator", async () => {
    const lunch = { ...GALA, id: "813", eventId: "41", eventName: "Board Lunch", coordinatorUserAccountId: "coordinator-2" };
    const { notifier, update } = build([GALA, lunch]);

    await update.execute(banquetSeats(80));

    expect(notifier.bookingsFlagged.map((notice) => [notice.bookingId, notice.recipientUserAccountId])).toEqual([
      ["812", "coordinator-1"],
      ["813", "coordinator-2"],
    ]);
  });

  it("AC4: tells nobody when the booking still fits, or when a further cut only restates its reason", async () => {
    const { notifier, update } = build();

    await update.execute(banquetSeats(120));
    expect(notifier.bookingsFlagged).toEqual([]);

    await update.execute(banquetSeats(80));
    await update.execute(banquetSeats(70));
    expect(notifier.bookingsFlagged).toHaveLength(1);
  });

  it("AC6: flags but tells nobody of a booking whose event has no coordinator", async () => {
    const { review, notifier, update } = build([{ ...GALA, coordinatorUserAccountId: null }]);

    await update.execute(banquetSeats(80));

    expect(review.all()).toHaveLength(1);
    expect(notifier.bookingsFlagged).toEqual([]);
  });

  it("tells nobody when the edit is refused", async () => {
    const { notifier, update } = build();

    await expect(update.execute(banquetSeats(80, { roles: [] }))).rejects.toThrow(VenueMaintenanceNotPermittedError);
    expect(notifier.bookingsFlagged).toEqual([]);
  });
});

describe("UpdateVenueUseCase tells the Organiser of a lapsed event (SPM-111)", () => {
  const lapse = {
    eventId: eventId("40"),
    eventName: "Harbour Lights Gala",
    eventRequestId: "12",
    owningOrganiserUserAccountId: userAccountId("organiser-6"),
    lapsed: [{ kind: "flagged-booking", venueLocation: "Main Hall" }] as const,
  };

  it("AC1, AC3: a venue edit that takes a Confirmed event out of Confirmed tells its Organiser what lapsed", async () => {
    const { review, notifier, update } = build();
    review.lapses = [lapse];

    await update.execute(banquetSeats(80));

    expect(notifier.eventsNoLongerConfirmed).toEqual([
      {
        recipientUserAccountId: "organiser-6",
        eventId: "40",
        eventRequestId: "12",
        eventName: "Harbour Lights Gala",
        lapsed: [{ kind: "flagged-booking", venueLocation: "Main Hall" }],
      },
    ]);
  });

  it("an edit that flags nothing tells no Organiser", async () => {
    const { review, notifier, update } = build();
    review.lapses = [lapse];

    await update.execute(banquetSeats(150));

    expect(notifier.eventsNoLongerConfirmed).toEqual([]);
  });
});
