import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
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
  slots: [],
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
    record: new RecordVenueUnavailabilityUseCase({ unavailability, venues, clock }),
    lift: new LiftVenueUnavailabilityUseCase({ unavailability, clock }),
    submit: new SubmitVenueBookingRequestUseCase({
      events: new InMemoryCoordinatorEventRepository([EVENT]),
      venues,
      bookings,
      clock,
    }),
  };
}

function request(slots: ReadonlyArray<{ date: string; slot: "AM" | "PM" | "Night" }>) {
  return { eventId: "event-1", userAccountId: COORDINATOR, venueId: "venue-hall", roomLayout: "Theatre", slots };
}

const BLOCK = {
  ...STAFF,
  venueId: "venue-hall",
  startDate: "2026-10-19",
  endDate: "2026-10-19",
  slots: ["AM"] as const,
  reason: "Renovation",
  note: null,
};

describe("a booking request over a venue block (SPM-270)", () => {
  it("AC12: the in-memory booking adapter refuses a request over an In force block", async () => {
    const { record, submit, bookings } = build();
    await record.execute({ ...BLOCK, slots: ["AM"] });

    await expect(submit.execute(request([{ date: "2026-10-19", slot: "AM" }]))).rejects.toBeInstanceOf(
      VenueSlotBlockedError,
    );
    expect(bookings.all()).toEqual([]);
  });

  it("AC12: the message the form shows names the date and slot", async () => {
    const { record, submit } = build();
    await record.execute({ ...BLOCK, slots: ["AM"] });

    // The booking form returns the domain error's message as it is.
    const error = await submit.execute(request([{ date: "2026-10-19", slot: "AM" }])).catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).message).toBe(
      "The venue is unavailable for 2026-10-19 AM. Choose other slots or another venue.",
    );
  });

  it("AC13: accepts a request for the day after a block", async () => {
    const { record, submit } = build();
    await record.execute({ ...BLOCK, slots: ["AM"] });

    const result = await submit.execute(request([{ date: "2026-10-20", slot: "AM" }]));

    expect(result.status).toBe("Requested");
  });

  it("AC13: accepts a request for another slot on a blocked day", async () => {
    const { record, submit } = build();
    await record.execute({ ...BLOCK, slots: ["AM"] });

    const result = await submit.execute(request([{ date: "2026-10-19", slot: "PM" }]));

    expect(result.status).toBe("Requested");
  });

  it("AC15: accepts a request once the block is lifted", async () => {
    const { record, lift, submit } = build();
    const { entry } = await record.execute({ ...BLOCK, slots: ["AM"] });
    await lift.execute({ ...STAFF, unavailabilityId: entry.id });

    const result = await submit.execute(request([{ date: "2026-10-19", slot: "AM" }]));

    expect(result.status).toBe("Requested");
  });
});
