import { describe, expect, it } from "vitest";

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
  type VenueSearchWindow,
} from "./venue-search";

const SG = "Asia/Singapore";
const TODAY = "2026-11-01";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: venueId("1"),
    location: "Marina Bay Hall",
    facilities: "Wi-Fi, Catering area",
    accessibility: "Step-free access, Lift access",
    openingHours: [{ start: "07:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
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
    start: null,
    end: null,
    ...overrides,
  };
}

/** A live booking at `venue` from `start` to `end` on 2026-11-02, Singapore time. */
function booked(start: string, end: string, id = "1"): BusyInterval {
  return {
    venueId: venueId(id),
    startsAt: new Date(`2026-11-02T${start}:00+08:00`),
    endsAt: new Date(`2026-11-02T${end}:00+08:00`),
    kind: "booking",
  };
}

/** A searched window on 2026-11-02 unless another date is given. */
function at(start: string, end: string, date = "2026-11-02"): VenueSearchWindow {
  return { date, start, end };
}

/** Whether the default venue (open 07:00-12:00 and 13:00-18:00) is free for the window. */
function openFor(start: string, end: string, busy: BusyInterval[] = [], date = "2026-11-02") {
  return isOpenFor(venue(), at(start, end, date), busy, TODAY, SG);
}

function refusal(search: VenueSearchInput): InvalidVenueSearchError {
  try {
    defineVenueSearch(search, TODAY);
  } catch (error) {
    if (error instanceof InvalidVenueSearchError) return error;
    throw error;
  }
  throw new Error("expected defineVenueSearch to refuse");
}

function flaggedField(search: VenueSearchInput): VenueSearchField | null {
  return refusal(search).field;
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
  it("is open when the booking is on another day", () => {
    expect(openFor("13:00", "18:00", [booked("12:00", "18:00")], "2026-11-03")).toBe(true);
  });

  it("ignores another venue's bookings", () => {
    expect(openFor("13:00", "18:00", [booked("12:00", "18:00", "2")])).toBe(true);
  });

  it("is open on the last day of the booking horizon, not the day after", () => {
    // TODAY + 30 days.
    expect(openFor("07:00", "12:00", [], "2026-12-01")).toBe(true);
    expect(openFor("07:00", "12:00", [], "2026-12-02")).toBe(false);
  });

  it("is not open when the venue has no opening hours or horizon recorded", () => {
    const window = at("07:00", "12:00");

    expect(isOpenFor(venue({ openingHours: [] }), window, [], TODAY, SG)).toBe(false);
    expect(isOpenFor(venue({ bookingHorizonDays: null }), window, [], TODAY, SG)).toBe(false);
  });

  it("takes today's date in the venues' timezone, not UTC", () => {
    // 17:00 UTC on 1 Nov is already 1 a.m. on 2 Nov in Singapore.
    expect(calendarDate(new Date("2026-11-01T17:00:00Z"), SG)).toBe("2026-11-02");
  });
});

describe("isOpenFor a start and end time (SPM-322)", () => {
  // The venue is open 07:00-12:00 and 13:00-18:00, closed for lunch and at night.
  describe("AC1: closed for any part of the time", () => {
    it("is open for a time inside its opening hours, up to their edges", () => {
      expect(openFor("07:00", "12:00")).toBe(true);
      expect(openFor("13:00", "18:00")).toBe(true);
      expect(openFor("09:15", "09:30")).toBe(true);
    });

    it.each([
      ["starts 15 minutes before it opens", "06:45", "08:00"],
      ["runs 15 minutes past the lunch close", "11:00", "12:15"],
      ["starts 15 minutes before it reopens", "12:45", "14:00"],
      ["spans the closed lunch hour", "11:00", "14:00"],
      ["runs 15 minutes past the evening close", "17:00", "18:15"],
      ["is wholly in closed time", "19:00", "22:00"],
    ])("is not open for a time that %s", (_case, start, end) => {
      expect(openFor(start, end)).toBe(false);
    });

    it("names the closed time, not a booking, as the reason", () => {
      const search = criteria({ window: at("11:45", "12:15") });

      expect(searchVenues([venue()], search, [], TODAY, SG).excluded).toEqual([
        { reason: "closed", count: 1 },
      ]);
    });
  });

  describe("AC1: a live booking or In force block overlaps it", () => {
    // Held 14:00-15:00 -- a Confirmed booking, a live hold or a block alike.
    const held = [booked("14:00", "15:00")];

    it.each([
      ["overlaps its start by 15 minutes", "13:45", "14:15"],
      ["overlaps its end by 15 minutes", "14:45", "15:15"],
      ["sits inside it", "14:15", "14:30"],
      ["covers it and more", "13:00", "18:00"],
      ["matches it exactly", "14:00", "15:00"],
    ])("is not open for a time that %s", (_case, start, end) => {
      expect(openFor(start, end, held)).toBe(false);
    });

    it("is not open when either of two held spans overlaps it", () => {
      expect(openFor("09:00", "11:00", [booked("07:00", "08:00"), booked("10:45", "11:00")])).toBe(
        false,
      );
    });
  });

  describe("AC2: touching is free", () => {
    const held = [booked("14:00", "15:00")];

    it("is open for a time that starts as the booking ends", () => {
      expect(openFor("15:00", "16:00", held)).toBe(true);
    });

    it("is open for a time that ends as the booking starts", () => {
      expect(openFor("13:00", "14:00", held)).toBe(true);
    });

    it("is open between two bookings that it touches at both ends", () => {
      expect(openFor("15:00", "16:00", [...held, booked("16:00", "17:00")])).toBe(true);
    });
  });

  describe("the last 15 minutes of the day", () => {
    const lateVenue = venue({ openingHours: [{ start: "19:00", end: "24:00" }] });
    const lastQuarter = at("23:45", "24:00");

    it("is open until 24:00 when nothing holds it", () => {
      expect(isOpenFor(lateVenue, lastQuarter, [], TODAY, SG)).toBe(true);
    });

    it("is open after a booking that ends at 23:45, not during one that runs to 24:00", () => {
      expect(isOpenFor(lateVenue, lastQuarter, [booked("23:30", "23:45")], TODAY, SG)).toBe(true);
      expect(isOpenFor(lateVenue, lastQuarter, [booked("23:30", "24:00")], TODAY, SG)).toBe(false);
    });
  });

  it("spans the window from its start to its end, in Singapore time", () => {
    expect(windowInstants(at("07:00", "12:15"), SG)).toEqual({
      from: new Date("2026-11-01T23:00:00Z"),
      to: new Date("2026-11-02T04:15:00Z"),
    });
    expect(windowInstants(at("19:00", "24:00"), SG)).toEqual({
      from: new Date("2026-11-02T11:00:00Z"),
      to: new Date("2026-11-02T16:00:00Z"),
    });
  });
});

describe("isOpenFor with setup and turnaround (SPM-250)", () => {
  // Setup 30 and turnaround 45, as Main Hall has.
  const hall = venue({ setupMinutes: 30, turnaroundMinutes: 45 });

  function hallOpenFor(start: string, end: string, busy: BusyInterval[]) {
    return isOpenFor(hall, at(start, end), busy, TODAY, SG);
  }

  /** An In force block on `venue` from `start` to `end` on 2026-11-02. */
  function blocked(start: string, end: string): BusyInterval {
    return { ...booked(start, end), kind: "block" };
  }

  describe("AC1: a booking's padded time overlaps the search's", () => {
    // Booked 07:00-09:15, so turned around until 10:00.
    const early = [booked("07:00", "09:15")];

    it.each([
      ["10:15", "setting up from 09:45, 15 minutes into the turnaround", false],
      ["10:30", "setting up from 10:00, as the turnaround ends", true],
      ["10:45", "setting up from 10:15, 15 minutes after it", true],
    ])("from %s, %s: open %s", (start, _case, open) => {
      expect(hallOpenFor(start, "11:45", early)).toBe(open);
    });

    // Booked 15:00-16:00, so set up from 14:30.
    const late = [booked("15:00", "16:00")];

    it.each([
      ["13:15", "turned around until 14:00, before the setup", true],
      ["13:45", "turned around until 14:30, as the setup begins", true],
      ["14:00", "turned around until 14:45, 15 minutes into the setup", false],
    ])("until %s, %s: open %s", (end, _case, open) => {
      expect(hallOpenFor("13:00", end, late)).toBe(open);
    });
  });

  describe("AC2: the search's padding and the booking's both count", () => {
    it("leaves the venue out when only the search's setup reaches the booking", () => {
      const setupOnly = venue({ setupMinutes: 30, turnaroundMinutes: 0 });

      expect(isOpenFor(setupOnly, at("09:15", "10:00"), [booked("07:00", "09:00")], TODAY, SG)).toBe(false);
      expect(isOpenFor(setupOnly, at("09:30", "10:00"), [booked("07:00", "09:00")], TODAY, SG)).toBe(true);
    });

    it("leaves the venue out when only the booking's turnaround reaches the search", () => {
      const turnaroundOnly = venue({ setupMinutes: 0, turnaroundMinutes: 45 });

      expect(isOpenFor(turnaroundOnly, at("09:30", "10:00"), [booked("07:00", "09:00")], TODAY, SG)).toBe(false);
      expect(isOpenFor(turnaroundOnly, at("09:45", "10:00"), [booked("07:00", "09:00")], TODAY, SG)).toBe(true);
    });
  });

  it("AC3: pads each venue with its own setup and turnaround, none set counting as 0", () => {
    const padded = venue({ id: venueId("1"), setupMinutes: 30, turnaroundMinutes: 45 });
    const zero = venue({ id: venueId("2"), setupMinutes: 0, turnaroundMinutes: 0 });
    const unset = venue({ id: venueId("3"), setupMinutes: null, turnaroundMinutes: null });
    const busy = ["1", "2", "3"].map((id) => booked("07:00", "09:15", id));

    expect(searchVenues([padded, zero, unset], criteria({ window: at("09:15", "10:00") }), busy, TODAY, SG)).toEqual({
      venues: [zero, unset],
      excluded: [{ reason: "booked", count: 1 }],
    });
  });

  describe("AC4: a block is compared with the times searched, unpadded", () => {
    it("lists the venue for a time that starts as the block ends, setup and all", () => {
      expect(hallOpenFor("09:15", "10:00", [blocked("07:00", "09:15")])).toBe(true);
    });

    it("lists the venue for a time that ends as the block starts", () => {
      expect(hallOpenFor("13:00", "14:00", [blocked("14:00", "15:00")])).toBe(true);
    });

    it("leaves the venue out when the block overlaps the time searched by 15 minutes", () => {
      expect(hallOpenFor("09:00", "10:00", [blocked("07:00", "09:15")])).toBe(false);
    });
  });

  describe("across midnight", () => {
    const allDay = venue({ setupMinutes: 30, turnaroundMinutes: 45, openingHours: [{ start: "00:00", end: "24:00" }] });
    // Booked 22:00-24:00 on 1 Nov, so turned around until 00:45 on 2 Nov.
    const lateNight: BusyInterval = {
      venueId: venueId("1"),
      startsAt: new Date("2026-11-01T22:00:00+08:00"),
      endsAt: new Date("2026-11-02T00:00:00+08:00"),
      kind: "booking",
    };

    it("leaves the venue out when the turnaround runs into the next day's setup", () => {
      expect(isOpenFor(allDay, at("01:00", "02:00"), [lateNight], TODAY, SG)).toBe(false);
    });

    it("lists it when the next day's setup begins as the turnaround ends", () => {
      expect(isOpenFor(allDay, at("01:15", "02:00"), [lateNight], TODAY, SG)).toBe(true);
    });
  });
});

describe("defineVenueSearch with a start and end time (SPM-322)", () => {
  it("reads a date with a start and end time as the window searched", () => {
    expect(
      defineVenueSearch(input({ date: "2026-11-02", start: "07:00", end: "12:15" }), TODAY).window,
    ).toEqual(at("07:00", "12:15"));
  });

  it("accepts 24:00 as an end, so the last 15 minutes of the day can be searched", () => {
    expect(
      defineVenueSearch(input({ date: "2026-11-02", start: "23:45", end: "24:00" }), TODAY).window,
    ).toEqual(at("23:45", "24:00"));
  });

  describe("AC3: refuses a time that cannot be searched, naming the problem", () => {
    it.each([
      ["a start off the 15-minute grid", "07:10", "12:00", "start", "07:10 is not on the 15-minute grid"],
      ["an end off the 15-minute grid", "07:00", "12:05", "end", "12:05 is not on the 15-minute grid"],
      ["a start that is not a time", "7am", "12:00", "start", "7am is not a time"],
      ["a start at 24:00", "24:00", "24:00", "start", "cannot start at 24:00"],
      ["an end equal to the start", "12:00", "12:00", "end", "must be after the start"],
      ["an end 15 minutes before the start", "12:00", "11:45", "end", "must be after the start"],
      ["a time crossing midnight", "22:00", "01:00", "end", "must be after the start"],
    ])("refuses %s", (_case, start, end, field, message) => {
      const error = refusal(input({ date: "2026-11-02", start, end }));

      expect(error.field).toBe(field);
      expect(error.message).toContain(message);
    });
  });

  it("refuses a date without both times, and times without a date", () => {
    expect(flaggedField(input({ date: "2026-11-02" }))).toBe("start");
    expect(flaggedField(input({ date: "2026-11-02", start: "07:00" }))).toBe("end");
    expect(flaggedField(input({ date: "2026-11-02", end: "12:00" }))).toBe("start");
    expect(flaggedField(input({ start: "07:00", end: "12:00" }))).toBe("date");
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
        start: "13:00",
        end: "18:00",
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
    ["closed", criteria({ window: at("19:00", "22:00") })],
    ["beyondHorizon", criteria({ window: at("07:00", "12:00", "2026-12-02") })],
    ["booked", criteria({ window: at("13:00", "18:00") })],
  ] as const)("names %s as the reason a venue was left out", (reason, search) => {
    const { excluded } = searchVenues([venue()], search, [booked("12:00", "18:00")], TODAY, SG);

    expect(excluded).toEqual([{ reason, count: 1 }]);
  });

  it("names missing opening hours as the reason when a window is searched", () => {
    const search = criteria({ window: at("07:00", "12:00") });

    expect(
      searchVenues([venue({ openingHours: [] })], search, [], TODAY, SG).excluded,
    ).toEqual([{ reason: "hoursUnknown", count: 1 }]);
  });

  it("counts a venue once, under the first filter it fails", () => {
    const search = criteria({ layout: "Banquet", facilities: ["Video-conferencing"] });

    expect(searchVenues([venue(), venue({ id: venueId("2") })], search, [], TODAY, SG).excluded).toEqual(
      [{ reason: "layout", count: 2 }],
    );
  });

  it("treats blank text as no filter", () => {
    expect(defineVenueSearch(input({ layout: "  ", date: "", start: " ", end: "" }), TODAY)).toEqual(
      criteria(),
    );
  });

  it("accepts today, refuses yesterday", () => {
    const times = { start: "07:00", end: "12:00" };

    expect(defineVenueSearch(input({ ...times, date: TODAY }), TODAY).window?.date).toBe(TODAY);
    expect(flaggedField(input({ ...times, date: "2026-10-31" }))).toBe("date");
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
