import { describe, expect, it } from "vitest";

import { InMemoryVenueAvailability } from "@/adapters/outbound/in-memory/in-memory-venue-availability";

import { venueId } from "./venue";
import { blockedBusyIntervals, type VenueUnavailabilityEntry } from "./venue-unavailability";

const HALL = venueId("5");

function entry(overrides: Partial<VenueUnavailabilityEntry> = {}): VenueUnavailabilityEntry {
  return {
    id: "1",
    venueId: HALL,
    venueLocation: "Grand Hall",
    startDate: "2026-10-20",
    endDate: "2026-10-20",
    reason: "Renovation",
    note: null,
    slots: [{ date: "2026-10-20", slot: "AM" }],
    status: "In force",
    recordedByName: "Test Venue Staff",
    recordedAt: "2026-10-05T04:00:00.000Z",
    liftedByName: null,
    liftedAt: null,
    ...overrides,
  };
}

const DAY_START = new Date("2026-10-20T00:00:00+08:00");
const DAY_END = new Date("2026-10-21T00:00:00+08:00");

describe("blocked slots as busy time (SPM-268)", () => {
  it("AC14: the busy-time read includes a blocked slot as busy for that venue", async () => {
    const availability = new InMemoryVenueAvailability(blockedBusyIntervals([entry()]));

    const busy = await availability.busyIntervals(DAY_START, DAY_END);

    expect(busy).toEqual([
      {
        venueId: HALL,
        startsAt: new Date("2026-10-20T07:00:00+08:00"),
        endsAt: new Date("2026-10-20T12:00:00+08:00"),
        kind: "block",
      },
    ]);
  });

  it("AC14: a slot another day or another slot is not made busy", async () => {
    const availability = new InMemoryVenueAvailability(blockedBusyIntervals([entry()]));

    expect(await availability.busyIntervals(DAY_END, new Date("2026-10-22T00:00:00+08:00"))).toEqual([]);
    const busy = await availability.busyIntervals(new Date("2026-10-20T12:00:00+08:00"), DAY_END);
    expect(busy).toEqual([]);
  });

  it("AC15: the busy-time read ignores a lifted block", async () => {
    const lifted = entry({ status: "Lifted", liftedByName: "Test Venue Staff", liftedAt: "2026-10-06T00:00:00.000Z" });

    expect(blockedBusyIntervals([lifted])).toEqual([]);
  });

  it("AC15, AC19: still busy when one of two overlapping blocks is lifted", async () => {
    const lifted = entry({ id: "1", status: "Lifted", liftedByName: "A", liftedAt: "2026-10-06T00:00:00.000Z" });
    const stillOn = entry({ id: "2", reason: "Safety" });
    const availability = new InMemoryVenueAvailability(blockedBusyIntervals([lifted, stillOn]));

    const busy = await availability.busyIntervals(DAY_START, DAY_END);

    expect(busy).toHaveLength(1);
    expect(busy[0].startsAt).toEqual(new Date("2026-10-20T07:00:00+08:00"));
  });

  it("AC19: two In force blocks over one slot make it busy once", () => {
    expect(blockedBusyIntervals([entry({ id: "1" }), entry({ id: "2", reason: "Safety" })])).toHaveLength(1);
  });
});

describe("blocked 15-minute slots as busy time (SPM-321)", () => {
  it("reports each quarter hour of a block on codes 36 to 45 as busy, 09:00 to 11:30 in all", async () => {
    const slots = Array.from({ length: 10 }, (_, i) => ({ date: "2026-10-20", slot: String(36 + i) }));
    const availability = new InMemoryVenueAvailability(blockedBusyIntervals([entry({ slots })]));

    const busy = await availability.busyIntervals(DAY_START, DAY_END);

    expect(busy[0]).toEqual({
      venueId: HALL,
      startsAt: new Date("2026-10-20T09:00:00+08:00"),
      endsAt: new Date("2026-10-20T09:15:00+08:00"),
      kind: "block",
    });
    expect(busy).toHaveLength(10);
    expect(busy[9].endsAt).toEqual(new Date("2026-10-20T11:30:00+08:00"));
  });

  it("makes the last quarter of the day end at midnight", async () => {
    const availability = new InMemoryVenueAvailability(
      blockedBusyIntervals([entry({ slots: [{ date: "2026-10-20", slot: "95" }] })]),
    );

    expect(await availability.busyIntervals(DAY_START, new Date("2026-10-22T00:00:00+08:00"))).toEqual([
      {
        venueId: HALL,
        startsAt: new Date("2026-10-20T23:45:00+08:00"),
        endsAt: new Date("2026-10-21T00:00:00+08:00"),
        kind: "block",
      },
    ]);
  });
});
