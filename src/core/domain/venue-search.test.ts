import { describe, expect, it } from "vitest";

import type { BookingSlot } from "./booking";
import { InvalidVenueSearchError, type VenueSearchField } from "./errors";
import { venueId, type Venue } from "./venue";
import {
  calendarDate,
  defineVenueSearch,
  isOpenFor,
  matchesAttributes,
  searchVenues,
  windowInstants,
  type BusyInterval,
  type VenueSearchCriteria,
  type VenueSearchInput,
} from "./venue-search";

const SG = "Asia/Singapore";
const TODAY = "2026-11-01";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: venueId("1"),
    location: "Marina Bay Hall",
    facilities: "Wi-Fi, Catering area",
    accessibility: "Step-free access, Lift access",
    slots: ["AM", "PM"],
    capacity: 300,
    bookingHorizonDays: 30,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Boardroom", capacity: 20 },
    ],
    ...overrides,
  };
}

function criteria(overrides: Partial<VenueSearchCriteria> = {}): VenueSearchCriteria {
  return {
    layout: null,
    attendance: null,
    facilities: [],
    accessibility: [],
    window: null,
    ...overrides,
  };
}

function input(overrides: Partial<VenueSearchInput> = {}): VenueSearchInput {
  return {
    layout: null,
    attendance: null,
    facilities: [],
    accessibility: [],
    date: null,
    slots: [],
    ...overrides,
  };
}

/** A live booking at `venue` from `start` to `end` on 2026-11-02, Singapore time. */
function booked(start: string, end: string, id = "1"): BusyInterval {
  return {
    venueId: venueId(id),
    startsAt: new Date(`2026-11-02T${start}:00+08:00`),
    endsAt: new Date(`2026-11-02T${end}:00+08:00`),
  };
}

function openFor(slots: BookingSlot[], busy: BusyInterval[] = [], date = "2026-11-02") {
  return isOpenFor(venue(), { date, slots }, busy, TODAY, SG);
}

function flaggedField(search: VenueSearchInput): VenueSearchField | null {
  try {
    defineVenueSearch(search, TODAY);
  } catch (error) {
    if (error instanceof InvalidVenueSearchError) return error.field;
    throw error;
  }
  throw new Error("expected defineVenueSearch to refuse");
}

describe("matchesAttributes (SPM-44)", () => {
  it("matches a layout that seats the attendance", () => {
    expect(matchesAttributes(venue(), criteria({ layout: "Theatre", attendance: 150 }))).toBe(true);
  });

  it("tests capacity on the searched layout, not another of the venue's layouts", () => {
    // Theatre seats 200, but the Boardroom asked for seats only 20.
    expect(matchesAttributes(venue(), criteria({ layout: "Boardroom", attendance: 100 }))).toBe(
      false,
    );
  });

  it.each([
    [99, true],
    [100, true],
    [101, false],
  ])("attendance %i against a layout seating 100 -> %s", (attendance, expected) => {
    const hall = venue({ layouts: [{ name: "Classroom", capacity: 100 }] });

    expect(matchesAttributes(hall, criteria({ layout: "Classroom", attendance }))).toBe(expected);
  });

  it("with attendance but no layout, matches if any layout seats it", () => {
    expect(matchesAttributes(venue(), criteria({ attendance: 200 }))).toBe(true);
    expect(matchesAttributes(venue(), criteria({ attendance: 201 }))).toBe(false);
  });

  it("never falls back to the venue-level capacity", () => {
    // SPM-106: venue.capacity is 300, but no layout seats 250.
    expect(matchesAttributes(venue(), criteria({ attendance: 250 }))).toBe(false);
  });

  it("excludes a venue without the searched layout", () => {
    expect(matchesAttributes(venue(), criteria({ layout: "Banquet" }))).toBe(false);
  });

  it("requires every selected facility", () => {
    expect(matchesAttributes(venue(), criteria({ facilities: ["Wi-Fi"] }))).toBe(true);
    expect(matchesAttributes(venue(), criteria({ facilities: ["Wi-Fi", "Video-conferencing"] }))).toBe(
      false,
    );
  });

  it("requires every selected accessibility feature", () => {
    expect(
      matchesAttributes(venue(), criteria({ accessibility: ["Step-free access", "Lift access"] })),
    ).toBe(true);
    expect(matchesAttributes(venue(), criteria({ accessibility: ["Hearing loop"] }))).toBe(false);
  });

  it("excludes a venue with no facilities recorded when one is asked for", () => {
    expect(matchesAttributes(venue({ facilities: null }), criteria({ facilities: ["Wi-Fi"] }))).toBe(
      false,
    );
  });
});

describe("isOpenFor (SPM-44)", () => {
  // The venue offers AM (07:00-12:00) and PM (12:00-18:00), not Night.
  it("is open in every slot the venue offers", () => {
    expect(openFor(["AM", "PM"])).toBe(true);
  });

  it("is not open in a slot the venue does not offer", () => {
    expect(openFor(["Night"])).toBe(false);
  });

  it("is not open when only some of the slots searched are offered", () => {
    expect(openFor(["PM", "Night"])).toBe(false);
  });

  it("is not open when a live booking holds the slot searched", () => {
    expect(openFor(["PM"], [booked("12:00", "18:00")])).toBe(false);
  });

  it("is not open when a live booking holds any one of the slots searched", () => {
    expect(openFor(["AM", "PM"], [booked("12:00", "18:00")])).toBe(false);
  });

  it("is open when the booking is in the next slot, touching only its edge", () => {
    expect(openFor(["AM"], [booked("12:00", "18:00")])).toBe(true);
  });

  it("is open when the booking is on another day", () => {
    expect(openFor(["PM"], [booked("12:00", "18:00")], "2026-11-03")).toBe(true);
  });

  it("ignores another venue's bookings", () => {
    expect(openFor(["PM"], [booked("12:00", "18:00", "2")])).toBe(true);
  });

  it("is open on the last day of the booking horizon, not the day after", () => {
    // TODAY + 30 days.
    expect(openFor(["AM"], [], "2026-12-01")).toBe(true);
    expect(openFor(["AM"], [], "2026-12-02")).toBe(false);
  });

  it("is not open when the venue has no slots or horizon recorded", () => {
    const window = { date: "2026-11-02", slots: ["AM"] as const };

    expect(isOpenFor(venue({ slots: [] }), window, [], TODAY, SG)).toBe(false);
    expect(isOpenFor(venue({ bookingHorizonDays: null }), window, [], TODAY, SG)).toBe(false);
  });

  it("spans the window from the first slot's start to the last one's end, in Singapore time", () => {
    expect(windowInstants({ date: "2026-11-02", slots: ["AM", "PM"] }, SG)).toEqual({
      from: new Date("2026-11-01T23:00:00Z"),
      to: new Date("2026-11-02T10:00:00Z"),
    });
    expect(windowInstants({ date: "2026-11-02", slots: ["Night"] }, SG)).toEqual({
      from: new Date("2026-11-02T10:00:00Z"),
      to: new Date("2026-11-02T14:00:00Z"),
    });
  });

  it("takes today's date in the venues' timezone, not UTC", () => {
    // 17:00 UTC on 1 Nov is already 1 a.m. on 2 Nov in Singapore.
    expect(calendarDate(new Date("2026-11-01T17:00:00Z"), SG)).toBe("2026-11-02");
  });
});

describe("venue search (SPM-44)", () => {
  it("with every filter blank, returns the whole catalogue", () => {
    const catalogue = [venue(), venue({ id: venueId("2"), facilities: null })];

    expect(searchVenues(catalogue, defineVenueSearch(input(), TODAY), [], TODAY, SG)).toEqual({
      venues: catalogue,
      excluded: [],
    });
  });

  it("combines attribute and availability filters", () => {
    const free = venue({ id: venueId("1") });
    const taken = venue({ id: venueId("2") });
    const tooSmall = venue({ id: venueId("3"), layouts: [{ name: "Theatre", capacity: 50 }] });
    const search = defineVenueSearch(
      input({
        layout: "Theatre",
        attendance: 100,
        date: "2026-11-02",
        slots: ["PM"],
      }),
      TODAY,
    );

    expect(
      searchVenues([free, taken, tooSmall], search, [booked("12:00", "18:00", "2")], TODAY, SG),
    ).toEqual({
      venues: [free],
      excluded: [
        { reason: "capacity", count: 1 },
        { reason: "booked", count: 1 },
      ],
    });
  });

  it("returns an empty list when nothing matches", () => {
    const search = defineVenueSearch(input({ layout: "Banquet" }), TODAY);

    expect(searchVenues([venue()], search, [], TODAY, SG)).toEqual({
      venues: [],
      excluded: [{ reason: "layout", count: 1 }],
    });
  });

  it("returns venues only -- no verdict or flag (#83)", () => {
    const [result] = searchVenues([venue()], criteria(), [], TODAY, SG).venues;

    expect(result).toEqual(venue());
  });

  it.each([
    ["layout", criteria({ layout: "Banquet" })],
    ["capacity", criteria({ layout: "Boardroom", attendance: 100 })],
    ["facilities", criteria({ facilities: ["Video-conferencing"] })],
    ["accessibility", criteria({ accessibility: ["Hearing loop"] })],
    ["slotNotOffered", criteria({ window: { date: "2026-11-02", slots: ["Night"] } })],
    ["beyondHorizon", criteria({ window: { date: "2026-12-02", slots: ["AM"] } })],
    ["booked", criteria({ window: { date: "2026-11-02", slots: ["PM"] } })],
  ] as const)("names %s as the reason a venue was left out", (reason, search) => {
    const { excluded } = searchVenues([venue()], search, [booked("12:00", "18:00")], TODAY, SG);

    expect(excluded).toEqual([{ reason, count: 1 }]);
  });

  it("names missing slots as the reason when a window is searched", () => {
    const search = criteria({ window: { date: "2026-11-02", slots: ["AM"] } });

    expect(
      searchVenues([venue({ slots: [] })], search, [], TODAY, SG).excluded,
    ).toEqual([{ reason: "slotsUnknown", count: 1 }]);
  });

  it("counts a venue once, under the first filter it fails", () => {
    const search = criteria({ layout: "Banquet", facilities: ["Video-conferencing"] });

    expect(searchVenues([venue(), venue({ id: venueId("2") })], search, [], TODAY, SG).excluded).toEqual(
      [{ reason: "layout", count: 2 }],
    );
  });

  it("treats blank text as no filter", () => {
    expect(defineVenueSearch(input({ layout: "  ", date: "", slots: [" "] }), TODAY)).toEqual(
      criteria(),
    );
  });

  it("refuses a date without a slot, and slots without a date", () => {
    expect(flaggedField(input({ date: "2026-11-02" }))).toBe("slots");
    expect(flaggedField(input({ slots: ["AM"] }))).toBe("date");
  });

  it("keeps the slots searched in the order the day runs", () => {
    const search = defineVenueSearch(input({ date: "2026-11-02", slots: ["Night", "AM"] }), TODAY);

    expect(search.window).toEqual({ date: "2026-11-02", slots: ["AM", "Night"] });
  });

  it("refuses a slot that is not AM, PM or Night", () => {
    expect(flaggedField(input({ date: "2026-11-02", slots: ["Evening"] }))).toBe("slots");
  });

  it("accepts today, refuses yesterday", () => {
    const slots = ["AM"];

    expect(defineVenueSearch(input({ slots, date: TODAY }), TODAY).window?.date).toBe(TODAY);
    expect(flaggedField(input({ slots, date: "2026-10-31" }))).toBe("date");
  });

  it("refuses values that are not options", () => {
    expect(flaggedField(input({ layout: "Cabaret" }))).toBe("layout");
    expect(flaggedField(input({ facilities: ["Jacuzzi"] }))).toBe("facilities");
    expect(flaggedField(input({ accessibility: ["Ramp"] }))).toBe("accessibility");
  });

  it.each([0, -1, 2.5])("refuses attendance %s", (attendance) => {
    expect(flaggedField(input({ attendance }))).toBe("attendance");
  });
});
