import { describe, expect, it } from "vitest";

import type { BookingSlot } from "./booking";
import { InvalidVenueError, type VenueField } from "./errors";
import {
  canMaintainVenues,
  defineVenue,
  exceedsVenueCapacity,
  STANDARD_LAYOUTS,
  type VenueDetails,
} from "./venue";
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from "./venue-options";

function details(overrides: Partial<VenueDetails> = {}): VenueDetails {
  return {
    location: "Level 3, Marina Bay Hall",
    facilities: "Projector, PA system",
    accessibility: "Step-free access",
    slots: ["AM", "PM", "Night"],
    capacity: 300,
    bookingHorizonDays: 180,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Boardroom", capacity: 24 },
    ],
    ...overrides,
  };
}

/** The field the domain flags when it refuses `input`. */
function flaggedField(input: VenueDetails): VenueField | null {
  try {
    defineVenue(input);
  } catch (error) {
    if (error instanceof InvalidVenueError) return error.field;
    throw error;
  }
  throw new Error("expected defineVenue to refuse");
}

describe("defineVenue (SPM-42)", () => {
  it("accepts a venue with every attribute and its layouts", () => {
    expect(defineVenue(details())).toEqual(details());
  });

  it("trims text", () => {
    const venue = defineVenue(details({ location: "  Hall A  ", facilities: " Wi-Fi ,Projector " }));

    expect(venue.location).toBe("Hall A");
    expect(venue.facilities).toBe("Wi-Fi, Projector");
  });

  it("trims a layout name", () => {
    const venue = defineVenue(details({ layouts: [{ name: " Banquet ", capacity: 30 }] }));

    expect(venue.layouts).toEqual([{ name: "Banquet", capacity: 30 }]);
  });

  describe("every field is mandatory", () => {
    it.each<[string, Partial<VenueDetails>, VenueField]>([
      ["location", { location: "   " }, "location"],
      ["facilities", { facilities: null }, "facilities"],
      ["blank facilities", { facilities: "  " }, "facilities"],
      ["accessibility", { accessibility: "" }, "accessibility"],
      ["slot", { slots: [] }, "slots"],
      ["venue capacity", { capacity: null }, "capacity"],
      ["booking horizon", { bookingHorizonDays: null }, "bookingHorizonDays"],
      ["layouts", { layouts: [] }, "layouts"],
    ])("refuses a missing %s and flags %s", (_name, overrides, field) => {
      expect(flaggedField(details(overrides))).toBe(field);
    });
  });

  describe("layout capacity is supplied, never computed", () => {
    it.each([0, -1, 1.5, Number.NaN])("refuses a capacity of %s", (capacity) => {
      expect(() => defineVenue(details({ layouts: [{ name: "Theatre", capacity }] }))).toThrow(
        InvalidVenueError,
      );
    });

    it("accepts the smallest capacity, 1", () => {
      expect(() => defineVenue(details({ layouts: [{ name: "Theatre", capacity: 1 }] }))).not.toThrow();
    });
  });

  it("refuses a layout with no name", () => {
    expect(() => defineVenue(details({ layouts: [{ name: " ", capacity: 10 }] }))).toThrow(
      InvalidVenueError,
    );
  });

  it.each([
    ["facilities", { facilities: "Projector, Trampoline" }],
    ["accessibility", { accessibility: "Moat" }],
    ["layouts", { layouts: [{ name: "U-shape", capacity: 30 }] }],
  ] as const)("refuses a value outside the %s list", (field, overrides) => {
    expect(flaggedField(details(overrides))).toBe(field);
  });

  it("refuses the same layout twice", () => {
    expect(() =>
      defineVenue(
        details({
          layouts: [
            { name: "Theatre", capacity: 100 },
            { name: "Theatre", capacity: 120 },
          ],
        }),
      ),
    ).toThrow(InvalidVenueError);
  });

  describe("venue-level capacity and booking horizon", () => {
    it.each([0, -1, 2.5])("refuses a venue capacity of %s", (capacity) => {
      expect(flaggedField(details({ capacity }))).toBe("capacity");
    });

    it("accepts a booking horizon of 0 days but not -1", () => {
      expect(() => defineVenue(details({ bookingHorizonDays: 0 }))).not.toThrow();
      expect(flaggedField(details({ bookingHorizonDays: -1 }))).toBe("bookingHorizonDays");
    });
  });

  describe("slots the venue offers", () => {
    it("accepts a single slot", () => {
      expect(defineVenue(details({ slots: ["Night"] })).slots).toEqual(["Night"]);
    });

    it("keeps slots in the order the day runs, whatever order they were picked in", () => {
      expect(defineVenue(details({ slots: ["Night", "AM"] })).slots).toEqual(["AM", "Night"]);
    });

    it("keeps a slot picked twice once", () => {
      expect(defineVenue(details({ slots: ["PM", "PM"] })).slots).toEqual(["PM"]);
    });

    it("refuses a slot that is not AM, PM or Night, flagging slots", () => {
      expect(flaggedField(details({ slots: ["Evening" as BookingSlot] }))).toBe("slots");
    });
  });
});

describe("facilities, accessibility and layouts come from fixed lists (SPM-42)", () => {
  it("accepts every listed facility, accessibility feature and layout at once", () => {
    const venue = defineVenue(
      details({
        facilities: FACILITY_OPTIONS.join(", "),
        accessibility: ACCESSIBILITY_OPTIONS.join(", "),
        layouts: STANDARD_LAYOUTS.map((name) => ({ name, capacity: 50 })),
      }),
    );

    expect(venue.facilities).toBe("Projector, PA system, Wi-Fi, Breakout rooms, Catering area");
    expect(venue.layouts).toHaveLength(STANDARD_LAYOUTS.length);
  });

  it.each(FACILITY_OPTIONS)("accepts %s as the only facility", (facility) => {
    expect(defineVenue(details({ facilities: facility })).facilities).toBe(facility);
  });

  it.each(ACCESSIBILITY_OPTIONS)("accepts %s as the only accessibility feature", (feature) => {
    expect(defineVenue(details({ accessibility: feature })).accessibility).toBe(feature);
  });

  it("stores a selection as its labels joined by a comma and a space", () => {
    expect(defineVenue(details({ facilities: "Wi-Fi,Projector" })).facilities).toBe(
      "Wi-Fi, Projector",
    );
  });

  it.each(["", "  ", ",", " , "])("refuses an empty selection %j, flagging facilities", (facilities) => {
    expect(flaggedField(details({ facilities }))).toBe("facilities");
  });

  it("refuses an empty accessibility selection, flagging accessibility", () => {
    expect(flaggedField(details({ accessibility: "," }))).toBe("accessibility");
  });

  it("refuses one unlisted value among listed ones", () => {
    expect(flaggedField(details({ facilities: "Projector, Trampoline" }))).toBe("facilities");
  });

  it("refuses the old free-text wording", () => {
    expect(flaggedField(details({ accessibility: "Step-free entrance" }))).toBe("accessibility");
  });

  it("refuses a listed value spelled in another case", () => {
    expect(flaggedField(details({ facilities: "projector" }))).toBe("facilities");
  });

  it("names the offending value and the allowed ones in the message", () => {
    expect(() => defineVenue(details({ facilities: "Trampoline" }))).toThrow(
      /Trampoline.*Projector/,
    );
  });

  it.each(STANDARD_LAYOUTS)("accepts %s as a layout", (name) => {
    expect(defineVenue(details({ layouts: [{ name, capacity: 10 }] })).layouts[0].name).toBe(name);
  });

  it("refuses a layout outside the list, flagging layouts", () => {
    expect(flaggedField(details({ layouts: [{ name: "Cabaret", capacity: 40 }] }))).toBe("layouts");
  });
});

describe("canMaintainVenues (SPM-148)", () => {
  it("allows Venue Staff", () => {
    expect(canMaintainVenues(["Venue Staff"])).toBe(true);
  });

  it.each([
    "Event Organiser",
    "Event Coordinator",
    "Event Coordinator Lead",
    "Technical Support Staff",
    "Attendee",
  ])("refuses %s", (role) => {
    expect(canMaintainVenues([role])).toBe(false);
  });

  it("refuses someone with no role", () => {
    expect(canMaintainVenues([])).toBe(false);
  });
});

describe("no layout seats more than the venue (SPM-106)", () => {
  const withTheatre = (capacity: number) =>
    details({ capacity: 200, layouts: [{ name: "Theatre", capacity }] });

  it.each([199, 200])("accepts a %s-seat layout in a 200-seat venue", (capacity) => {
    expect(defineVenue(withTheatre(capacity)).layouts).toEqual([{ name: "Theatre", capacity }]);
  });

  it("refuses a 201-seat layout in a 200-seat venue, flagging layouts", () => {
    expect(flaggedField(withTheatre(201))).toBe("layouts");
    expect(() => defineVenue(withTheatre(201))).toThrow(
      "The Theatre layout cannot seat more than the venue's capacity of 200.",
    );
  });

  it("refuses when any one layout is too big, not only the first", () => {
    const input = details({
      capacity: 100,
      layouts: [
        { name: "Boardroom", capacity: 20 },
        { name: "Banquet", capacity: 150 },
      ],
    });

    expect(flaggedField(input)).toBe("layouts");
  });
});

describe("exceedsVenueCapacity (SPM-106)", () => {
  it.each([
    [199, false],
    [200, false],
    [201, true],
  ])("a %s-seat layout in a 200-seat venue exceeds it: %s", (layout, expected) => {
    expect(exceedsVenueCapacity(layout, 200)).toBe(expected);
  });
});
