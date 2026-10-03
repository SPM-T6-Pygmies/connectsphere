import { describe, expect, it } from "vitest";

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

function criteria(
  overrides: Partial<VenueSearchCriteria> = {},
): VenueSearchCriteria {
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
    startTime: null,
    endTime: null,
    ...overrides,
  };
}

/** A live booking holding venue `id` from `start` to `end` on `date`. */
function held(
  start: string,
  end: string,
  id = "1",
  date = "2026-11-02",
): BookedSlot {
  return { venueId: venueId(id), date, start, end };
}

/** The default venue (open 09:00-17:00) against `start`-`end` on `date`. */
function openFor(
  start: string,
  end: string,
  booked: BookedSlot[] = [],
  date = "2026-11-02",
  overrides: Partial<Venue> = {},
) {
  return isOpenFor(venue(overrides), { date, start, end }, booked, TODAY);
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
    expect(
      matchesAttributes(
        venue(),
        criteria({ layout: "Theatre", attendance: 150 }),
      ),
    ).toBe(true);
  });

  it("tests capacity on the searched layout, not another of the venue's layouts", () => {
    // Theatre seats 200, but the Boardroom asked for seats only 20.
    expect(
      matchesAttributes(
        venue(),
        criteria({ layout: "Boardroom", attendance: 100 }),
      ),
    ).toBe(false);
  });

  it.each([
    [99, true],
    [100, true],
    [101, false],
  ])(
    "attendance %i against a layout seating 100 -> %s",
    (attendance, expected) => {
      const hall = venue({ layouts: [{ name: "Classroom", capacity: 100 }] });

      expect(
        matchesAttributes(hall, criteria({ layout: "Classroom", attendance })),
      ).toBe(expected);
    },
  );

  it("with attendance but no layout, matches if any layout seats it", () => {
    expect(matchesAttributes(venue(), criteria({ attendance: 200 }))).toBe(
      true,
    );
    expect(matchesAttributes(venue(), criteria({ attendance: 201 }))).toBe(
      false,
    );
  });

  it("never falls back to the venue-level capacity", () => {
    // SPM-106: venue.capacity is 300, but no layout seats 250.
    expect(matchesAttributes(venue(), criteria({ attendance: 250 }))).toBe(
      false,
    );
  });

  it("excludes a venue without the searched layout", () => {
    expect(matchesAttributes(venue(), criteria({ layout: "Banquet" }))).toBe(
      false,
    );
  });

  it("requires every selected facility", () => {
    expect(
      matchesAttributes(venue(), criteria({ facilities: ["Projector"] })),
    ).toBe(true);
    expect(
      matchesAttributes(
        venue(),
        criteria({ facilities: ["Projector", "Wi-Fi"] }),
      ),
    ).toBe(false);
  });

  it("requires every selected accessibility feature", () => {
    expect(
      matchesAttributes(
        venue(),
        criteria({ accessibility: ["Step-free access", "Lift access"] }),
      ),
    ).toBe(true);
    expect(
      matchesAttributes(venue(), criteria({ accessibility: ["Hearing loop"] })),
    ).toBe(false);
  });

  it("excludes a venue with no facilities recorded when one is asked for", () => {
    expect(
      matchesAttributes(
        venue({ facilities: null }),
        criteria({ facilities: ["Wi-Fi"] }),
      ),
    ).toBe(false);
  });
});

describe("isOpenFor (SPM-44)", () => {
  it("is open for a window inside the venue's hours, and one that fills them exactly", () => {
    expect(openFor("10:00", "11:30")).toBe(true);
    expect(openFor("09:00", "17:00")).toBe(true);
  });

  it.each([
    ["starts before it opens", "08:45", "10:00"],
    ["ends after it closes", "16:00", "17:15"],
    ["falls wholly outside", "18:00", "19:00"],
  ])("is not open for a window that %s", (_name, start, end) => {
    expect(openFor(start, end)).toBe(false);
  });

  it("needs the whole window inside the hours, not just part of it", () => {
    expect(openFor("08:00", "10:00")).toBe(false);
    expect(openFor("16:00", "18:00")).toBe(false);
  });

  it("is not open when a live booking overlaps the window", () => {
    expect(openFor("10:00", "12:00", [held("11:00", "13:00")])).toBe(false);
    expect(openFor("10:00", "12:00", [held("09:00", "10:15")])).toBe(false);
    expect(openFor("10:00", "12:00", [held("10:30", "11:00")])).toBe(false);
  });

  it("is open when a booking ends as the window starts, or starts as it ends", () => {
    expect(openFor("10:00", "12:00", [held("09:00", "10:00")])).toBe(true);
    expect(openFor("10:00", "12:00", [held("12:00", "13:00")])).toBe(true);
  });

  it("ignores a booking on another day", () => {
    expect(
      openFor("10:00", "12:00", [held("10:00", "12:00", "1", "2026-11-03")]),
    ).toBe(true);
  });

  it("ignores another venue's bookings", () => {
    expect(openFor("10:00", "12:00", [held("10:00", "12:00", "2")])).toBe(true);
  });

  it("is open on the last day of the booking horizon, not the day after", () => {
    // TODAY + 30 days.
    expect(openFor("10:00", "11:00", [], "2026-12-01")).toBe(true);
    expect(openFor("10:00", "11:00", [], "2026-12-02")).toBe(false);
  });

  it("is not open when the venue has no operating hours or horizon recorded", () => {
    expect(
      openFor("10:00", "11:00", [], "2026-11-02", {
        operatingHoursStart: null,
      }),
    ).toBe(false);
    expect(
      openFor("10:00", "11:00", [], "2026-11-02", { bookingHorizonDays: null }),
    ).toBe(false);
  });

  it("takes today's date in the venues' timezone, not UTC", () => {
    // 17:00 UTC on 1 Nov is already 1 a.m. on 2 Nov in Singapore.
    expect(calendarDate(new Date("2026-11-01T17:00:00Z"), SG)).toBe(
      "2026-11-02",
    );
  });
});

describe("venue search (SPM-44)", () => {
  it("with every filter blank, returns the whole catalogue", () => {
    const catalogue = [venue(), venue({ id: venueId("2"), facilities: null })];

    expect(
      searchVenues(catalogue, defineVenueSearch(input(), TODAY), [], TODAY),
    ).toEqual({
      venues: catalogue,
      excluded: [],
    });
  });

  it("combines attribute and availability filters", () => {
    const free = venue({ id: venueId("1") });
    const taken = venue({ id: venueId("2") });
    const tooSmall = venue({
      id: venueId("3"),
      layouts: [{ name: "Theatre", capacity: 50 }],
    });
    const search = defineVenueSearch(
      input({
        layout: "Theatre",
        attendance: 100,
        date: "2026-11-02",
        startTime: "13:00",
        endTime: "15:00",
      }),
      TODAY,
    );

    expect(
      searchVenues(
        [free, taken, tooSmall],
        search,
        [held("14:00", "16:00", "2")],
        TODAY,
      ),
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
    [
      "outsideHours",
      criteria({
        window: { date: "2026-11-02", start: "18:00", end: "19:00" },
      }),
    ],
    [
      "beyondHorizon",
      criteria({
        window: { date: "2026-12-02", start: "10:00", end: "11:00" },
      }),
    ],
    [
      "booked",
      criteria({
        window: { date: "2026-11-02", start: "13:00", end: "14:00" },
      }),
    ],
  ] as const)(
    "names %s as the reason a venue was left out",
    (reason, search) => {
      const { excluded } = searchVenues(
        [venue()],
        search,
        [held("13:30", "15:00")],
        TODAY,
      );

      expect(excluded).toEqual([{ reason, count: 1 }]);
    },
  );

  it("names missing hours as the reason when a window is searched", () => {
    const search = criteria({
      window: { date: "2026-11-02", start: "10:00", end: "11:00" },
    });

    expect(
      searchVenues([venue({ operatingHoursEnd: null })], search, [], TODAY)
        .excluded,
    ).toEqual([{ reason: "hoursUnknown", count: 1 }]);
  });

  it("counts a venue once, under the first filter it fails", () => {
    const search = criteria({ layout: "Banquet", facilities: ["Wi-Fi"] });

    expect(
      searchVenues([venue(), venue({ id: venueId("2") })], search, [], TODAY)
        .excluded,
    ).toEqual([{ reason: "layout", count: 2 }]);
  });

  it("treats blank text as no filter", () => {
    expect(
      defineVenueSearch(
        input({ layout: "  ", date: "", startTime: " ", endTime: "" }),
        TODAY,
      ),
    ).toEqual(criteria());
  });

  it("refuses a date without times, and times without a date", () => {
    expect(flaggedField(input({ date: "2026-11-02" }))).toBe("startTime");
    expect(
      flaggedField(input({ date: "2026-11-02", startTime: "10:00" })),
    ).toBe("endTime");
    expect(flaggedField(input({ startTime: "10:00", endTime: "11:00" }))).toBe(
      "date",
    );
  });

  it("refuses a time off the 15-minute grid", () => {
    expect(
      flaggedField(
        input({ date: "2026-11-02", startTime: "10:10", endTime: "11:00" }),
      ),
    ).toBe("startTime");
    expect(
      flaggedField(
        input({ date: "2026-11-02", startTime: "10:00", endTime: "11:05" }),
      ),
    ).toBe("endTime");
    expect(
      flaggedField(
        input({ date: "2026-11-02", startTime: "ten", endTime: "11:00" }),
      ),
    ).toBe("startTime");
  });

  it("refuses an end that is not after the start", () => {
    expect(
      flaggedField(
        input({ date: "2026-11-02", startTime: "11:00", endTime: "11:00" }),
      ),
    ).toBe("endTime");
    expect(
      flaggedField(
        input({ date: "2026-11-02", startTime: "14:00", endTime: "13:00" }),
      ),
    ).toBe("endTime");
  });

  it("reads a valid window", () => {
    const search = defineVenueSearch(
      input({ date: "2026-11-02", startTime: "07:15", endTime: "08:45" }),
      TODAY,
    );

    expect(search.window).toEqual({
      date: "2026-11-02",
      start: "07:15",
      end: "08:45",
    });
  });

  it("accepts today, refuses yesterday", () => {
    const times = { startTime: "10:00", endTime: "11:00" };

    expect(
      defineVenueSearch(input({ ...times, date: TODAY }), TODAY).window?.date,
    ).toBe(TODAY);
    expect(flaggedField(input({ ...times, date: "2026-10-31" }))).toBe("date");
  });

  it("refuses values that are not options", () => {
    expect(flaggedField(input({ layout: "Cabaret" }))).toBe("layout");
    expect(flaggedField(input({ facilities: ["Jacuzzi"] }))).toBe("facilities");
    expect(flaggedField(input({ accessibility: ["Ramp"] }))).toBe(
      "accessibility",
    );
  });

  it.each([0, -1, 2.5])("refuses attendance %s", (attendance) => {
    expect(flaggedField(input({ attendance }))).toBe("attendance");
  });
});
