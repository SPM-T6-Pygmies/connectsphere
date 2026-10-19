import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import {
  InMemoryVenueUnavailabilityRepository,
  type SeededBooking,
} from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";

import {
  UnavailabilityAlreadyLiftedError,
  VenueNotFoundError,
  VenueUnavailabilityNotPermittedError,
} from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { venueId, type Venue } from "../domain/venue";
import { slotsStillBlocked } from "../domain/venue-unavailability";
import { LiftVenueUnavailabilityUseCase } from "./lift-venue-unavailability";
import { ListVenueUnavailabilityUseCase } from "./list-venue-unavailability";
import {
  RecordVenueUnavailabilityUseCase,
  type RecordVenueUnavailabilityCommand,
} from "./record-venue-unavailability";

const STAFF = ["Venue Staff"];
/** Monday 5 October 2026, midday in Singapore. */
const NOW = new Date("2026-10-05T04:00:00.000Z");

const GRAND_HALL: Venue = {
  id: venueId("venue-1"),
  location: "Grand Hall",
  facilities: "Wi-Fi",
  accessibility: "Step-free access",
  slots: ["AM", "PM", "Night"],
  capacity: 300,
  bookingHorizonDays: 180,
  layouts: [{ name: "Theatre", capacity: 200 }],
};

function build(bookings: readonly SeededBooking[] = []) {
  const unavailability = new InMemoryVenueUnavailabilityRepository(
    new FixedClock(NOW),
    new Map([[GRAND_HALL.id, "Grand Hall"]]),
    new Map([
      ["staff-1", "Test Venue Staff"],
      ["staff-2", "Second Venue Staff"],
    ]),
    bookings,
  );
  const venues = new InMemoryVenueCatalogue([GRAND_HALL]);
  const clock = new FixedClock(NOW);
  return {
    unavailability,
    record: new RecordVenueUnavailabilityUseCase({ unavailability, venues, clock }),
    lift: new LiftVenueUnavailabilityUseCase({ unavailability, clock }),
    list: new ListVenueUnavailabilityUseCase({ unavailability }),
  };
}

function block(overrides: Partial<RecordVenueUnavailabilityCommand> = {}): RecordVenueUnavailabilityCommand {
  return {
    roles: STAFF,
    userAccountId: "staff-1",
    venueId: GRAND_HALL.id,
    startDate: "2026-10-12",
    endDate: "2026-10-14",
    slots: ["AM", "PM"],
    reason: "Renovation",
    note: null,
    ...overrides,
  };
}

const read = { roles: STAFF, userAccountId: "staff-1" };

describe("RecordVenueUnavailabilityUseCase (SPM-267)", () => {
  it("AC1: records a block for a venue in the catalogue and lists it In force", async () => {
    const { record, list } = build();

    const { entry } = await record.execute(block());
    const { entries } = await list.execute(read);

    expect(entry).toMatchObject({ venueLocation: "Grand Hall", status: "In force", reason: "Renovation" });
    expect(entry.recordedByName).toBe("Test Venue Staff");
    expect(entries).toEqual([entry]);
  });

  it("AC1: saves one record per date and slot (Mon to Wed, AM and PM gives six)", async () => {
    const { record } = build();

    const { entry } = await record.execute(block());

    expect(entry.slots).toEqual([
      { date: "2026-10-12", slot: "AM" },
      { date: "2026-10-12", slot: "PM" },
      { date: "2026-10-13", slot: "AM" },
      { date: "2026-10-13", slot: "PM" },
      { date: "2026-10-14", slot: "AM" },
      { date: "2026-10-14", slot: "PM" },
    ]);
  });

  it("AC2: refuses a venue that is not in the catalogue", async () => {
    const { record, list } = build();

    await expect(record.execute(block({ venueId: "venue-404" }))).rejects.toBeInstanceOf(VenueNotFoundError);
    expect((await list.execute(read)).entries).toEqual([]);
  });

  it("AC9: refuses a caller who is not Venue Staff (record)", async () => {
    const { record, list } = build();

    await expect(record.execute(block({ roles: ["Event Coordinator"] }))).rejects.toBeInstanceOf(
      VenueUnavailabilityNotPermittedError,
    );
    expect((await list.execute(read)).entries).toEqual([]);
  });

  it("AC10: records over an existing booking and leaves that booking's status unchanged", async () => {
    const booking: SeededBooking = {
      id: "booking-1",
      venueId: GRAND_HALL.id,
      eventName: "Founders' Gala Dinner",
      status: "Confirmed",
      slots: [{ date: "2026-10-13", slot: "AM" }],
    };
    const { record, unavailability } = build([booking]);

    await record.execute(block());

    expect(unavailability.seededBookings()).toEqual([booking]);
    expect(unavailability.seededBookings()[0].status).toBe("Confirmed");
  });

  it("AC11: returns the overlapping bookings (event, date, slot) on record", async () => {
    const { record } = build([
      {
        id: "booking-1",
        venueId: GRAND_HALL.id,
        eventName: "Founders' Gala Dinner",
        status: "Confirmed",
        slots: [
          { date: "2026-10-13", slot: "AM" },
          { date: "2026-10-13", slot: "Night" },
        ],
      },
      {
        id: "booking-2",
        venueId: GRAND_HALL.id,
        eventName: "Rejected Workshop",
        status: "Rejected",
        slots: [{ date: "2026-10-12", slot: "PM" }],
      },
    ]);

    const { affectedBookings } = await record.execute(block());

    expect(affectedBookings).toEqual([
      {
        bookingId: "booking-1",
        eventName: "Founders' Gala Dinner",
        status: "Confirmed",
        date: "2026-10-13",
        slot: "AM",
      },
    ]);
  });

  it("AC11: returns an empty list when nothing overlaps", async () => {
    const { record } = build([
      {
        id: "booking-1",
        venueId: GRAND_HALL.id,
        eventName: "Elsewhere",
        status: "Confirmed",
        slots: [{ date: "2026-11-01", slot: "AM" }],
      },
    ]);

    const { affectedBookings } = await record.execute(block());

    expect(affectedBookings).toEqual([]);
  });

  it("AC19: records a second block over the same venue, date and slot", async () => {
    const { record, list } = build();

    await record.execute(block());
    const second = await record.execute(block({ reason: "Safety", userAccountId: "staff-2" }));

    expect(second.entry.status).toBe("In force");
    expect((await list.execute(read)).entries).toHaveLength(2);
  });
});

describe("LiftVenueUnavailabilityUseCase (SPM-267)", () => {
  it("AC15: lifts an In force block", async () => {
    const { record, lift } = build();
    const { entry } = await record.execute(block());

    const lifted = await lift.execute({ ...read, unavailabilityId: entry.id });

    expect(lifted.entry.status).toBe("Lifted");
  });

  it("AC15: after lifting, a slot covered by another In force block stays blocked", async () => {
    const { record, lift, list } = build();
    const first = await record.execute(block({ startDate: "2026-10-12", endDate: "2026-10-13" }));
    await record.execute(
      block({ startDate: "2026-10-13", endDate: "2026-10-14", reason: "Safety", userAccountId: "staff-2" }),
    );

    await lift.execute({ ...read, unavailabilityId: first.entry.id });
    const { entries } = await list.execute(read);

    const blocked = slotsStillBlocked(entries).map(({ date, slot }) => `${date} ${slot}`);
    expect(blocked).toContain("2026-10-13 AM");
    expect(blocked).toContain("2026-10-14 PM");
    expect(blocked).not.toContain("2026-10-12 AM");
  });

  it("AC16: keeps a lifted block listed as Lifted with who and when", async () => {
    const { record, lift, list } = build();
    const { entry } = await record.execute(block());

    await lift.execute({ ...read, userAccountId: "staff-2", unavailabilityId: entry.id });
    const { entries } = await list.execute(read);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      status: "Lifted",
      liftedByName: "Second Venue Staff",
      liftedAt: NOW.toISOString(),
    });
  });

  it("AC17: refuses lifting a block that is already lifted", async () => {
    const { record, lift } = build();
    const { entry } = await record.execute(block());
    await lift.execute({ ...read, unavailabilityId: entry.id });

    await expect(lift.execute({ ...read, unavailabilityId: entry.id })).rejects.toBeInstanceOf(
      UnavailabilityAlreadyLiftedError,
    );
  });

  it("AC9: refuses a caller who is not Venue Staff (lift)", async () => {
    const { record, lift, list } = build();
    const { entry } = await record.execute(block());

    await expect(
      lift.execute({ roles: ["Technical Support Staff"], userAccountId: "staff-1", unavailabilityId: entry.id }),
    ).rejects.toBeInstanceOf(VenueUnavailabilityNotPermittedError);
    expect((await list.execute(read)).entries[0].status).toBe("In force");
  });
});

describe("RecordVenueUnavailabilityUseCase flags (SPM-313)", () => {
  const OTHER_VENUE = venueId("venue-2");
  const COORDINATOR = "coordinator-1";

  function seeded(overrides: Partial<SeededBooking> & Pick<SeededBooking, "id">): SeededBooking {
    return {
      venueId: GRAND_HALL.id,
      eventName: "Tech Summit",
      status: "Confirmed",
      slots: [{ date: "2026-10-13", slot: "PM" }],
      eventId: "event-1",
      coordinatorUserAccountId: COORDINATOR,
      ...overrides,
    };
  }

  const PM_ON_13 = { startDate: "2026-10-13", endDate: "2026-10-13", slots: ["PM"] } as const;

  it("AC1: flags a Confirmed booking the block covers and hands back whom to tell", async () => {
    const { record } = build([seeded({ id: "booking-1" })]);

    const { flaggedBookings } = await record.execute(block({ ...PM_ON_13, reason: "Maintenance" }));

    expect(flaggedBookings).toEqual([
      {
        bookingId: "booking-1",
        eventId: "event-1",
        eventName: "Tech Summit",
        coordinatorUserAccountId: COORDINATOR,
        venueLocation: "Grand Hall",
        detail: "Maintenance: 2026-10-13 13:00 to 18:00",
      },
    ]);
  });

  it("AC1: flags a live hold, but not a hold that has run out", async () => {
    const live = seeded({ id: "live", status: "Tentative Hold", holdExpiresAt: new Date("2026-10-07T12:00:00+08:00") });
    const lapsed = seeded({ id: "lapsed", status: "Tentative Hold", holdExpiresAt: new Date("2026-10-04T12:00:00+08:00") });
    const { record } = build([live, lapsed]);

    const { flaggedBookings } = await record.execute(block(PM_ON_13));

    expect(flaggedBookings.map((flagged) => flagged.bookingId)).toEqual(["live"]);
  });

  it("AC1: lists a Requested booking as affected but does not flag it", async () => {
    const { record } = build([seeded({ id: "requested", status: "Requested" })]);

    const { affectedBookings, flaggedBookings } = await record.execute(block(PM_ON_13));

    expect(affectedBookings.map((booking) => booking.bookingId)).toEqual(["requested"]);
    expect(flaggedBookings).toEqual([]);
  });

  it("AC2: flags nothing for other slots, other days and other venues", async () => {
    const { record } = build([
      seeded({ id: "am", slots: [{ date: "2026-10-13", slot: "AM" }] }),
      seeded({ id: "night", slots: [{ date: "2026-10-13", slot: "Night" }] }),
      seeded({ id: "next-day", slots: [{ date: "2026-10-14", slot: "PM" }] }),
      seeded({ id: "elsewhere", venueId: OTHER_VENUE }),
    ]);

    const { flaggedBookings } = await record.execute(block(PM_ON_13));

    expect(flaggedBookings).toEqual([]);
  });

  it("AC3: leaves a flagged booking's status and the booking itself as they were", async () => {
    const booking = seeded({ id: "booking-1" });
    const { record, unavailability } = build([booking]);

    await record.execute(block(PM_ON_13));

    expect(unavailability.seededBookings()).toEqual([booking]);
  });

  it("AC5: gives a booking under two blocks two reasons, one per block", async () => {
    const { record, unavailability } = build([seeded({ id: "booking-1" })]);

    await record.execute(block({ ...PM_ON_13, reason: "Renovation" }));
    await record.execute(block({ ...PM_ON_13, reason: "Equipment failure" }));

    const flags = await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(flags.map((flag) => flag.detail)).toEqual([
      "Renovation: 2026-10-13 13:00 to 18:00",
      "Equipment failure: 2026-10-13 13:00 to 18:00",
    ]);
  });

  it("AC6: keeps the flag when the block is lifted, and says so in its reason", async () => {
    const { record, lift, unavailability } = build([seeded({ id: "booking-1" })]);
    const { entry } = await record.execute(block({ ...PM_ON_13, reason: "Maintenance" }));

    await lift.execute({ roles: STAFF, userAccountId: "staff-2", unavailabilityId: entry.id });

    const flags = await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(flags.map((flag) => flag.detail)).toEqual([
      "Maintenance: 2026-10-13 13:00 to 18:00, block lifted 2026-10-05 12:00",
    ]);
  });

  it("AC6: leaves the other block's reason as it was when one block is lifted", async () => {
    const { record, lift, unavailability } = build([seeded({ id: "booking-1" })]);
    const first = await record.execute(block({ ...PM_ON_13, reason: "Renovation" }));
    await record.execute(block({ ...PM_ON_13, reason: "Equipment failure" }));

    await lift.execute({ roles: STAFF, userAccountId: "staff-1", unavailabilityId: first.entry.id });

    const flags = await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(flags.map((flag) => flag.detail)).toEqual([
      "Renovation: 2026-10-13 13:00 to 18:00, block lifted 2026-10-05 12:00",
      "Equipment failure: 2026-10-13 13:00 to 18:00",
    ]);
  });

  it("AC7: flags only the booking at the blocked venue when an event has several", async () => {
    const { record } = build([
      seeded({ id: "hall-a" }),
      seeded({ id: "hall-c", venueId: OTHER_VENUE }),
    ]);

    const { flaggedBookings } = await record.execute(block(PM_ON_13));

    expect(flaggedBookings.map((flagged) => flagged.bookingId)).toEqual(["hall-a"]);
  });

  it("AC4: shows the flag to the event's coordinator and to nobody else", async () => {
    const { record, unavailability } = build([seeded({ id: "booking-1" })]);
    await record.execute(block(PM_ON_13));

    expect(await unavailability.openForEvent(userAccountId("coordinator-2"), "event-1")).toEqual([]);
    expect(await unavailability.openForEvent(userAccountId(COORDINATOR), "event-2")).toEqual([]);
  });
});
