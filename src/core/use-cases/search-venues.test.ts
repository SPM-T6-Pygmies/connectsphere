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
    facilities: "Projector, Wi-Fi",
    accessibility: "Step-free access",
    operatingHoursStart: "09:00",
    operatingHoursEnd: "18:00",
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
    startTime: null,
    endTime: null,
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

describe("SearchVenuesUseCase (SPM-44)", () => {
  it("excludes a venue booked during the searched window, keeps one that is free", async () => {
    const busy = [
      {
        venueId: venueId("a"),
        startsAt: new Date("2026-11-05T10:00:00+08:00"),
        endsAt: new Date("2026-11-05T15:00:00+08:00"),
      },
    ];
    const useCase = build([venue("a"), venue("b")], busy);

    const result = await useCase.execute(
      search({ date: "2026-11-05", startTime: "10:00", endTime: "15:00" }),
    );

    expect(ids(result)).toEqual(["b"]);
  });

  it("applies attribute and date filters together", async () => {
    const useCase = build([
      venue("a"),
      venue("b", { layouts: [{ name: "Theatre", capacity: 80 }] }),
      venue("c", { operatingHoursEnd: "12:00" }),
    ]);

    const result = await useCase.execute(
      search({
        layout: "Theatre",
        attendance: 100,
        facilities: ["Wi-Fi"],
        date: "2026-11-05",
        startTime: "10:00",
        endTime: "15:00",
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
      venue("b", { facilities: "Projector" }),
      venue("c", { bookingHorizonDays: 1 }),
    ]).execute(
      search({ facilities: ["Wi-Fi"], date: "2026-11-05", startTime: "10:00", endTime: "11:00" }),
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
        search({ date: "2026-10-31", startTime: "10:00", endTime: "11:00" }),
      ),
    ).rejects.toBeInstanceOf(InvalidVenueSearchError);
  });
});
