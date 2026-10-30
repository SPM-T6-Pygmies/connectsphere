import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryVenueAvailability } from "@/adapters/outbound/in-memory/in-memory-venue-availability";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import { InvalidVenueSearchError } from "../domain/errors";
import { venueId, type Venue } from "../domain/venue";
import type { BusyInterval, VenueSearchInput } from "../domain/venue-search";
import { SearchVenuesUseCase } from "./search-venues";

// 1 Nov 2026, 10:00 in Singapore.
const NOW = new Date("2026-11-01T02:00:00Z");

function venue(id: string, overrides: Partial<Venue> = {}): Venue {
  return {
    id: venueId(id),
    location: `Hall ${id}`,
    facilities: "Wi-Fi, Catering area",
    accessibility: "Step-free access",
    openingHours: [{ start: "07:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    capacity: 300,
    bookingHorizonDays: 60,
    layouts: [{ name: "Theatre", capacity: 120 }],
    ...overrides,
  };
}

function search(overrides: Partial<VenueSearchInput> = {}): VenueSearchInput {
  return {
    layout: null,
    attendance: null,
    facilities: [],
    accessibility: [],
    date: null,
    start: null,
    end: null,
    ...overrides,
  };
}

function build(venues: Venue[], busy: BusyInterval[] = []) {
  return new SearchVenuesUseCase({
    venues: new InMemoryVenueCatalogue(venues),
    availability: new InMemoryVenueAvailability(busy),
    clock: new FixedClock(NOW),
    timeZone: "Asia/Singapore",
  });
}

const ids = (result: { venues: readonly Venue[] }) => result.venues.map((v) => v.id);

/** `id` held from `start` to `end` on 5 Nov 2026, Singapore time. */
function held(id: string, start: string, end: string): BusyInterval {
  return {
    venueId: venueId(id),
    startsAt: new Date(`2026-11-05T${start}:00+08:00`),
    endsAt: new Date(`2026-11-05T${end}:00+08:00`),
    kind: "booking",
  };
}

describe("SearchVenuesUseCase by start and end time (SPM-322)", () => {
  const afternoon = { date: "2026-11-05", start: "15:00", end: "16:00" };

  it("excludes a venue held for 15 minutes of the searched time, keeps one that is free", async () => {
    const useCase = build([venue("a"), venue("b")], [held("a", "15:45", "16:00")]);

    expect(ids(await useCase.execute(search(afternoon)))).toEqual(["b"]);
  });

  it("keeps venues held only up to the start, or only from the end", async () => {
    const useCase = build(
      [venue("a"), venue("b")],
      [held("a", "13:00", "15:00"), held("b", "16:00", "18:00")],
    );

    expect(ids(await useCase.execute(search(afternoon)))).toEqual(["a", "b"]);
  });

  it("refuses a time off the 15-minute grid", async () => {
    await expect(
      build([venue("a")]).execute(search({ ...afternoon, start: "15:10" })),
    ).rejects.toBeInstanceOf(InvalidVenueSearchError);
  });
});

describe("SearchVenuesUseCase with setup and turnaround (SPM-250)", () => {
  // The most a venue can have: 150 minutes each, so 15:00-16:00 takes the room from 12:30 to 18:30.
  const slowest = venue("a", { setupMinutes: 150, turnaroundMinutes: 150 });
  const afternoon = { date: "2026-11-05", start: "15:00", end: "16:00" };

  it.each([
    ["10:00", "10:15", "turned around until 12:45, into the setup", []],
    ["09:45", "10:00", "turned around until 12:30, as the setup begins", ["a"]],
    ["20:45", "21:00", "set up from 18:15, into the turnaround", []],
    ["21:00", "21:15", "set up from 18:30, as the turnaround ends", ["a"]],
  ])("reads a booking %s-%s, hours from the time searched: %s", async (start, end, _case, listed) => {
    const useCase = build([slowest], [held("a", start, end)]);

    expect(ids(await useCase.execute(search(afternoon)))).toEqual(listed);
  });
});

describe("SearchVenuesUseCase (SPM-44)", () => {
  it("applies attribute and date filters together", async () => {
    const useCase = build([
      venue("a"),
      venue("b", { layouts: [{ name: "Theatre", capacity: 80 }] }),
      venue("c", { openingHours: [{ start: "07:00", end: "12:00" }] }),
    ]);

    const result = await useCase.execute(
      search({
        layout: "Theatre",
        attendance: 100,
        facilities: ["Wi-Fi"],
        date: "2026-11-05",
        start: "13:00",
        end: "18:00",
      }),
    );

    expect(ids(result)).toEqual(["a"]);
  });

  it("with blank filters returns the whole catalogue", async () => {
    const result = await build([venue("a"), venue("b")]).execute(search());

    expect(ids(result)).toEqual(["a", "b"]);
  });

  it("returns an empty list when no venue matches", async () => {
    const result = await build([venue("a")]).execute(search({ layout: "Banquet" }));

    expect(result.venues).toEqual([]);
  });

  it("reports how many venues each filter left out", async () => {
    const result = await build([
      venue("a"),
      venue("b", { facilities: "Catering area" }),
      venue("c", { bookingHorizonDays: 1 }),
    ]).execute(
      search({ facilities: ["Wi-Fi"], date: "2026-11-05", start: "13:00", end: "18:00" }),
    );

    expect(ids(result)).toEqual(["a"]);
    expect(result.excluded).toEqual([
      { reason: "facilities", count: 1 },
      { reason: "beyondHorizon", count: 1 },
    ]);
  });

  it("refuses a search for a date already past in Singapore", async () => {
    await expect(
      build([venue("a")]).execute(
        search({ date: "2026-10-31", start: "13:00", end: "18:00" }),
      ),
    ).rejects.toBeInstanceOf(InvalidVenueSearchError);
  });
});
