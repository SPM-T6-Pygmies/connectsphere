import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";
import {
  InMemoryVenueUnavailabilityRepository,
  type SeededBooking,
} from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";

import {
  DuplicateUnavailabilityError,
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
  openingHours: [{ start: "07:00", end: "12:00" }, { start: "13:00", end: "18:00" }, { start: "19:00", end: "24:00" }],
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
    startTime: "09:00",
    endTime: "10:00",
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

  it("AC1: saves one record per date and 15-minute slot (Mon to Wed, 09:00 to 10:00 gives twelve)", async () => {
    const { record } = build();

    const { entry } = await record.execute(block());

    expect(entry.slots).toEqual(
      ["2026-10-12", "2026-10-13", "2026-10-14"].flatMap((date) =>
        ["36", "37", "38", "39"].map((slot) => ({ date, slot })),
      ),
    );
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

  it("AC11: returns the overlapping bookings (event, date, time) on record", async () => {
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

    // The block is 09:00 to 10:00, the part of the 07:00 to 12:00 booking it takes (SPM-324).
    expect(affectedBookings).toEqual([
      {
        bookingId: "booking-1",
        eventName: "Founders' Gala Dinner",
        status: "Confirmed",
        date: "2026-10-13",
        start: "09:00",
        end: "10:00",
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
    expect(blocked).toContain("2026-10-13 36");
    expect(blocked).toContain("2026-10-14 39");
    expect(blocked).not.toContain("2026-10-12 36");
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

  const PM_ON_13 = { startDate: "2026-10-13", endDate: "2026-10-13", startTime: "13:00", endTime: "18:00" } as const;

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

  it("AC6: keeps the flag when the block is lifted, and tells the page when it was lifted", async () => {
    const { record, lift, unavailability } = build([seeded({ id: "booking-1" })]);
    const { entry } = await record.execute(block({ ...PM_ON_13, reason: "Maintenance" }));

    await lift.execute({ roles: STAFF, userAccountId: "staff-2", unavailabilityId: entry.id });

    const flags = await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(flags.map((flag) => flag.detail)).toEqual(["Maintenance: 2026-10-13 13:00 to 18:00"]);
    expect(flags.map((flag) => flag.sourceLiftedAt)).toEqual([NOW.toISOString()]);
  });

  it("AC6: marks only the lifted block's reason as lifted when a booking has two", async () => {
    const { record, lift, unavailability } = build([seeded({ id: "booking-1" })]);
    const first = await record.execute(block({ ...PM_ON_13, reason: "Renovation" }));
    await record.execute(block({ ...PM_ON_13, reason: "Equipment failure" }));

    await lift.execute({ roles: STAFF, userAccountId: "staff-1", unavailabilityId: first.entry.id });

    const flags = await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(flags.map((flag) => [flag.detail, flag.sourceLiftedAt])).toEqual([
      ["Renovation: 2026-10-13 13:00 to 18:00", NOW.toISOString()],
      ["Equipment failure: 2026-10-13 13:00 to 18:00", null],
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

  it("AC4: shows no flag on a booking that has since been cancelled, and keeps it on its sibling", async () => {
    const { record, unavailability } = build([
      seeded({ id: "hall-a" }),
      seeded({ id: "hall-b", slots: [{ date: "2026-10-13", slot: "PM" }] }),
    ]);
    await record.execute(block(PM_ON_13));

    unavailability.endBooking("hall-a", "Released");

    const flags = await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1");
    expect(flags.map((flag) => flag.bookingId)).toEqual(["hall-b"]);
  });

  it("AC1: no longer hands back a booking that has since been cancelled as flagged by the block", async () => {
    const { record, unavailability } = build([seeded({ id: "booking-1" })]);
    const { entry } = await record.execute(block(PM_ON_13));

    unavailability.endBooking("booking-1", "Released");

    expect(await unavailability.flaggedBookings(userAccountId("staff-1"), entry.id)).toEqual([]);
  });

  it("AC4: stops showing a held booking's flag once its hold has run out", async () => {
    const hold = seeded({
      id: "hold-1",
      status: "Tentative Hold",
      holdExpiresAt: new Date("2026-10-08T12:00:00+08:00"),
    });
    const { record, unavailability } = build([hold]);
    await record.execute(block(PM_ON_13));
    expect(await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1")).toHaveLength(1);

    unavailability.endBooking("hold-1", "Expired");

    expect(await unavailability.openForEvent(userAccountId(COORDINATOR), "event-1")).toEqual([]);
  });
});

describe("RecordVenueUnavailabilityUseCase by time of day (SPM-321)", () => {
  it("AC3a: refuses a block over the hour the venue is closed for lunch, and stores nothing", async () => {
    const { record, list } = build();

    await expect(record.execute(block({ startTime: "11:30", endTime: "13:30" }))).rejects.toThrow(
      "The venue is closed 12:00–13:00",
    );
    expect((await list.execute(read)).entries).toEqual([]);
  });

  it("AC3a: judges the hours of the venue chosen, not of any venue", async () => {
    const lateOnly: Venue = { ...GRAND_HALL, id: venueId("venue-2"), openingHours: [{ start: "19:00", end: "24:00" }] };
    const unavailability = new InMemoryVenueUnavailabilityRepository(new FixedClock(NOW));
    const record = new RecordVenueUnavailabilityUseCase({
      unavailability,
      venues: new InMemoryVenueCatalogue([GRAND_HALL, lateOnly]),
      clock: new FixedClock(NOW),
    });

    await expect(record.execute(block({ venueId: lateOnly.id }))).rejects.toThrow("closed 09:00–10:00");
    const { entry } = await record.execute(block({ venueId: GRAND_HALL.id }));
    expect(entry).toMatchObject({ venueId: GRAND_HALL.id, status: "In force" });
    expect(entry.slots).toHaveLength(12);
  });

  function seeded(): SeededBooking {
    return {
      id: "booking-1",
      venueId: GRAND_HALL.id,
      eventName: "Tech Summit",
      status: "Confirmed",
      slots: [{ date: "2026-10-13", slot: "PM" }],
      eventId: "event-1",
      coordinatorUserAccountId: "coordinator-1",
    };
  }

  it("flags a booking a shorter block only clips, and says only the clashing hours", async () => {
    // The PM booking runs 13:00 to 18:00; the block is 17:00 to 18:00, its last hour.
    const { record } = build([seeded()]);

    const { flaggedBookings, affectedBookings } = await record.execute(
      block({ startDate: "2026-10-13", endDate: "2026-10-13", startTime: "17:00", endTime: "18:00", reason: "Safety" }),
    );

    expect(flaggedBookings.map((flagged) => flagged.detail)).toEqual(["Safety: 2026-10-13 17:00 to 18:00"]);
    expect(affectedBookings).toEqual([
      // The time the block takes from the booking (SPM-324), not the booking's whole 13:00 to 18:00.
      {
        bookingId: "booking-1",
        eventName: "Tech Summit",
        status: "Confirmed",
        date: "2026-10-13",
        start: "17:00",
        end: "18:00",
      },
    ]);
  });

  it("refuses the same block saved twice and stores only the first", async () => {
    const { record, list } = build();

    await record.execute(block());
    await expect(record.execute(block())).rejects.toBeInstanceOf(DuplicateUnavailabilityError);

    expect((await list.execute(read)).entries).toHaveLength(1);
  });

  it("refuses the same block even when a different member of Venue Staff saves it", async () => {
    const { record } = build();
    await record.execute(block());

    await expect(record.execute(block({ userAccountId: "staff-2" }))).rejects.toBeInstanceOf(
      DuplicateUnavailabilityError,
    );
  });

  it("still accepts overlapping blocks that differ in reason, times or days (SPM-21 AC19)", async () => {
    const { record, list } = build();
    await record.execute(block());

    await record.execute(block({ reason: "Safety" }));
    await record.execute(block({ startTime: "09:30", endTime: "10:30" }));
    await record.execute(block({ endDate: "2026-10-15" }));

    expect((await list.execute(read)).entries).toHaveLength(4);
  });

  it("lets Venue Staff record the same Other block more than once, with or without the same note", async () => {
    const { record, list } = build();

    await record.execute(block({ reason: "Other", note: "Film shoot" }));
    await record.execute(block({ reason: "Other", note: "Film shoot" }));
    await record.execute(block({ reason: "Other", note: null }));

    expect((await list.execute(read)).entries).toHaveLength(3);
  });

  it("accepts the same block again once the first has been lifted", async () => {
    const { record, lift } = build();
    const { entry } = await record.execute(block());
    await lift.execute({ ...read, unavailabilityId: entry.id });

    const second = await record.execute(block());

    expect(second.entry.status).toBe("In force");
    expect(second.entry.id).not.toBe(entry.id);
  });
});
