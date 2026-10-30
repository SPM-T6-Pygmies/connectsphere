import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import { InMemoryVenueStaffDirectory } from "@/adapters/outbound/in-memory/in-memory-venue-staff-directory";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { InMemoryVenueUnavailabilityRepository } from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";
import { VenueSlotBlockedError } from "@/core/domain/errors";
import { venueId, type Venue } from "@/core/domain/venue";

import { LiftVenueUnavailabilityUseCase } from "./lift-venue-unavailability";
import { RecordVenueUnavailabilityUseCase } from "./record-venue-unavailability";
import { SubmitVenueBookingRequestUseCase } from "./submit-venue-booking-request";

const COORDINATOR = "coordinator-1";
const STAFF = { roles: ["Venue Staff"], userAccountId: "staff-1" };

const EVENT: SeedCoordinatorEvent = {
  id: "event-1",
  eventRequestId: "request-1",
  name: "Annual Conference",
  clientOrganisationName: "Acme",
  preferredDate: "2026-10-19",
  status: "Planning",
  assignedCoordinatorUserAccountId: COORDINATOR,
  description: null,
  expectedAttendance: null,
  clientOrganisationId: "org-1",
  owningOrganiserUserAccountId: "organiser-1",
};

const HALL: Venue = {
  id: venueId("venue-hall"),
  location: "Main Hall",
  capacity: 300,
  facilities: null,
  accessibility: null,
  openingHours: [{ start: "00:00", end: "24:00" }],
  bookingHorizonDays: null,
  layouts: [{ name: "Theatre", capacity: 300 }],
};

/** Monday 5 October 2026, midday in Singapore. */
const NOW = new Date("2026-10-05T04:00:00.000Z");

/** The booking store reads the same blocks the use cases record, as production's database does. */
function build() {
  const clock = new FixedClock(NOW);
  const venues = new InMemoryVenueCatalogue([HALL]);
  const unavailability = new InMemoryVenueUnavailabilityRepository(clock);
  const bookings = new InMemoryBookingRepository([], new Map(), unavailability);
  return {
    bookings,
    record: new RecordVenueUnavailabilityUseCase({ unavailability, venues, clock, notifier: new RecordingNotifier() }),
    lift: new LiftVenueUnavailabilityUseCase({ unavailability, clock }),
    submit: new SubmitVenueBookingRequestUseCase({
      events: new InMemoryCoordinatorEventRepository([EVENT]),
      venues,
      bookings,
      flags: { openForEvent: async () => [] },
      venueStaff: new InMemoryVenueStaffDirectory(),
      notifier: new RecordingNotifier(),
      clock,
    }),
  };
}

const MORNING = { start: "07:00", end: "12:00" };
const AFTERNOON = { start: "13:00", end: "18:00" };
const EVENING = { start: "19:00", end: "24:00" };

function request(times: ReadonlyArray<{ date: string; start: string; end: string }>) {
  return {
    eventId: "event-1",
    userAccountId: COORDINATOR,
    venueId: "venue-hall",
    roomLayout: "Theatre",
    times,
  };
}

const BLOCK = {
  ...STAFF,
  venueId: "venue-hall",
  startDate: "2026-10-19",
  endDate: "2026-10-19",
  startTime: "09:00",
  endTime: "11:30",
  reason: "Renovation",
  note: null,
};

describe("a booking request over a venue block (SPM-270)", () => {
  it("AC12: the in-memory booking adapter refuses a request over an In force block", async () => {
    const { record, submit, bookings } = build();
    await record.execute(BLOCK);

    await expect(submit.execute(request([{ date: "2026-10-19", ...MORNING }]))).rejects.toBeInstanceOf(
      VenueSlotBlockedError,
    );
    expect(bookings.all()).toEqual([]);
  });

  it("AC12: the message the form shows names the date and the blocked times, not the slot asked for", async () => {
    const { record, submit } = build();
    await record.execute(BLOCK);

    // The booking form returns the domain error's message as it is.
    const error = await submit.execute(request([{ date: "2026-10-19", ...MORNING }])).catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).message).toBe(
      "The venue is unavailable for 2026-10-19 09:00–11:30. Choose other times or another venue.",
    );
  });

  it("AC13: accepts a request for the day after a block", async () => {
    const { record, submit } = build();
    await record.execute(BLOCK);

    const result = await submit.execute(request([{ date: "2026-10-20", ...MORNING }]));

    expect(result.status).toBe("Requested");
  });

  it("AC13: accepts a request for a slot on a blocked day whose hours the block does not reach", async () => {
    const { record, submit } = build();
    await record.execute(BLOCK);

    // The block is 09:00-11:30: 13:00-18:00 and 19:00-24:00 are clear of it.
    expect((await submit.execute(request([{ date: "2026-10-19", ...AFTERNOON }]))).status).toBe("Requested");
    expect((await submit.execute(request([{ date: "2026-10-19", ...EVENING }]))).status).toBe("Requested");
  });

  it("refuses 07:00-12:00 for a block that covers only a quarter hour of it, at either end", async () => {
    // 07:00-07:15 and 11:45-12:00 each clip one quarter hour of it.
    for (const [startTime, endTime] of [["07:00", "07:15"], ["11:45", "12:00"]]) {
      const { record, submit, bookings } = build();
      await record.execute({ ...BLOCK, startTime, endTime });

      await expect(submit.execute(request([{ date: "2026-10-19", ...MORNING }]))).rejects.toBeInstanceOf(
        VenueSlotBlockedError,
      );
      expect(bookings.all()).toEqual([]);
    }
  });

  it("accepts 07:00-12:00 when the block starts exactly as it ends", async () => {
    const { record, submit } = build();
    await record.execute({ ...BLOCK, startTime: "12:00", endTime: "13:00" });

    expect((await submit.execute(request([{ date: "2026-10-19", ...MORNING }]))).status).toBe("Requested");
  });

  it("AC15: accepts a request once the block is lifted", async () => {
    const { record, lift, submit } = build();
    const { entry } = await record.execute(BLOCK);
    await lift.execute({ ...STAFF, unavailabilityId: entry.id });

    const result = await submit.execute(request([{ date: "2026-10-19", ...MORNING }]));

    expect(result.status).toBe("Requested");
  });
});
