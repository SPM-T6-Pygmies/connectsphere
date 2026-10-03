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
  type BookedSlot,
  type VenueSearchCriteria,
  type VenueSearchInput,
} from "./venue-search";

const SG = "Asia/Singapore";
const TODAY = "2026-11-01";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: venueId("1"),
    location: "Marina Bay Hall",
    facilities: "Projector, PA system",
    accessibility: "Step-free access, Lift access",
    operatingHoursStart: "09:00",
    operatingHoursEnd: "17:00",
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

/** A live booking holding `slot` at venue `id` on `date`. */
function held(slot: BookingSlot, id = "1", date = "2026-11-02"): BookedSlot {
  return { venueId: venueId(id), date, slot };
}

/** The default venue (open 09:00-17:00) against `slots` on `date`. */
function openFor(
  slots: BookingSlot[],
  booked: BookedSlot[] = [],
  date = "2026-11-02",
  overrides: Partial<Venue> = {},
) {
  return isOpenFor(venue(overrides), { date, slots }, booked, TODAY);
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
    expect(matchesAttributes(venue(), criteria({ facilities: ["Projector"] }))).toBe(true);
    expect(matchesAttributes(venue(), criteria({ facilities: ["Projector", "Wi-Fi"] }))).toBe(
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
  it("is open for the slots the venue operates in", () => {
    // Open 09:00-17:00: inside Morning (06:00-12:00) and Afternoon (12:00-18:00).
    expect(openFor(["AM"])).toBe(true);
    expect(openFor(["PM"])).toBe(true);
    expect(openFor(["AM", "PM"])).toBe(true);
  });

  it("is not open for a slot it never operates in", () => {
    expect(openFor(["Night"])).toBe(false);
  });

  it("must operate in every slot asked for", () => {
    expect(openFor(["AM", "Night"])).toBe(false);
  });

  it.each([
    ["opens 11:59, so operates in Morning", { operatingHoursStart: "11:59" }, "AM", true],
    ["opens 12:00, as Morning ends", { operatingHoursStart: "12:00" }, "AM", false],
    ["closes 18:01, so operates in Night", { operatingHoursEnd: "18:01" }, "Night", true],
    ["closes 18:00, as Night starts", { operatingHoursEnd: "18:00" }, "Night", false],
  ] as const)("a venue that %s", (_name, hours, slot, expected) => {
    expect(openFor([slot], [], "2026-11-02", hours)).toBe(expected);
  });

  it("is not open when a live booking holds a slot asked for", () => {
    expect(openFor(["PM"], [held("PM")])).toBe(false);
  });

  it("is not open when a live booking holds just one of the slots asked for", () => {
    expect(openFor(["AM", "PM"], [held("PM")])).toBe(false);
  });

  it("is open in another slot on the same day", () => {
    expect(openFor(["AM"], [held("PM")])).toBe(true);
  });

  it("ignores a booking on another day", () => {
    expect(openFor(["PM"], [held("PM", "1", "2026-11-03")])).toBe(true);
  });

  it("ignores another venue's bookings", () => {
    expect(openFor(["PM"], [held("PM", "2")])).toBe(true);
  });

  it("is open on the last day of the booking horizon, not the day after", () => {
    // TODAY + 30 days.
    expect(openFor(["AM"], [], "2026-12-01")).toBe(true);
    expect(openFor(["AM"], [], "2026-12-02")).toBe(false);
  });

  it("is not open when the venue has no operating hours or horizon recorded", () => {
    expect(openFor(["AM"], [], "2026-11-02", { operatingHoursStart: null })).toBe(false);
    expect(openFor(["AM"], [], "2026-11-02", { bookingHorizonDays: null })).toBe(false);
  });

  it("takes today's date in the venues' timezone, not UTC", () => {
    // 17:00 UTC on 1 Nov is already 1 a.m. on 2 Nov in Singapore.
    expect(calendarDate(new Date("2026-11-01T17:00:00Z"), SG)).toBe("2026-11-02");
  });
});

describe("venue search (SPM-44)", () => {
  it("with every filter blank, returns the whole catalogue", () => {
    const catalogue = [venue(), venue({ id: venueId("2"), facilities: null })];

    expect(searchVenues(catalogue, defineVenueSearch(input(), TODAY), [], TODAY)).toEqual({
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

    expect(searchVenues([free, taken, tooSmall], search, [held("PM", "2")], TODAY)).toEqual({
      venues: [free],
      excluded: [
        { reason: "capacity", count: 1 },
        { reason: "booked", count: 1 },
      ],
    });
  });

  it("returns an empty list when nothing matches", () => {
    const search = defineVenueSearch(input({ layout: "Banquet" }), TODAY);

    expect(searchVenues([venue()], search, [], TODAY)).toEqual({
      venues: [],
      excluded: [{ reason: "layout", count: 1 }],
    });
  });

  it("returns venues only -- no verdict or flag (#83)", () => {
    const [result] = searchVenues([venue()], criteria(), [], TODAY).venues;

    expect(result).toEqual(venue());
  });

  it.each([
    ["layout", criteria({ layout: "Banquet" })],
    ["capacity", criteria({ layout: "Boardroom", attendance: 100 })],
    ["facilities", criteria({ facilities: ["Wi-Fi"] })],
    ["accessibility", criteria({ accessibility: ["Hearing loop"] })],
    ["outsideHours", criteria({ window: { date: "2026-11-02", slots: ["Night"] } })],
    ["beyondHorizon", criteria({ window: { date: "2026-12-02", slots: ["AM"] } })],
    ["booked", criteria({ window: { date: "2026-11-02", slots: ["PM"] } })],
  ] as const)("names %s as the reason a venue was left out", (reason, search) => {
    const { excluded } = searchVenues([venue()], search, [held("PM")], TODAY);

    expect(excluded).toEqual([{ reason, count: 1 }]);
  });

  it("names missing hours as the reason when a window is searched", () => {
    const search = criteria({ window: { date: "2026-11-02", slots: ["AM"] } });

    expect(searchVenues([venue({ operatingHoursEnd: null })], search, [], TODAY).excluded).toEqual([
      { reason: "hoursUnknown", count: 1 },
    ]);
  });

  it("counts a venue once, under the first filter it fails", () => {
    const search = criteria({ layout: "Banquet", facilities: ["Wi-Fi"] });

    expect(searchVenues([venue(), venue({ id: venueId("2") })], search, [], TODAY).excluded).toEqual(
      [{ reason: "layout", count: 2 }],
    );
  });

  it("treats blank text as no filter", () => {
    expect(defineVenueSearch(input({ layout: "  ", date: "", slots: [" "] }), TODAY)).toEqual(
      criteria(),
    );
  });

  it("refuses a date without a time slot, and a time slot without a date", () => {
    expect(flaggedField(input({ date: "2026-11-02" }))).toBe("slots");
    expect(flaggedField(input({ slots: ["AM"] }))).toBe("date");
  });

  it("refuses a time slot that does not exist", () => {
    expect(flaggedField(input({ date: "2026-11-02", slots: ["Evening"] }))).toBe("slots");
    expect(flaggedField(input({ date: "2026-11-02", slots: ["AM", "noon"] }))).toBe("slots");
  });

  it("keeps the slots in the order they fall in a day, once each", () => {
    const search = defineVenueSearch(
      input({ date: "2026-11-02", slots: ["Night", "AM", "AM"] }),
      TODAY,
    );

    expect(search.window).toEqual({ date: "2026-11-02", slots: ["AM", "Night"] });
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
