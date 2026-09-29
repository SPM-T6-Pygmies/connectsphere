import { describe, expect, it } from "vitest";

import { InvalidVenueError, type VenueField } from "./errors";
import { canMaintainVenues, defineVenue, type VenueDetails } from "./venue";

function details(overrides: Partial<VenueDetails> = {}): VenueDetails {
  return {
    location: "Level 3, Marina Bay Hall",
    facilities: "Projector, PA system",
    accessibility: "Step-free access",
    operatingHoursStart: "08:00",
    operatingHoursEnd: "22:00",
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
      ["opening time", { operatingHoursStart: null }, "operatingHoursStart"],
      ["closing time", { operatingHoursEnd: null }, "operatingHoursEnd"],
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
    it("keeps a venue capacity as supplied, even below a layout's capacity", () => {
      expect(defineVenue(details({ capacity: 10 })).capacity).toBe(10);
    });

    it.each([0, -1, 2.5])("refuses a venue capacity of %s", (capacity) => {
      expect(flaggedField(details({ capacity }))).toBe("capacity");
    });

    it("accepts a booking horizon of 0 days but not -1", () => {
      expect(() => defineVenue(details({ bookingHorizonDays: 0 }))).not.toThrow();
      expect(flaggedField(details({ bookingHorizonDays: -1 }))).toBe("bookingHorizonDays");
    });
  });

  describe("operating hours", () => {
    it("refuses closing at the moment it opens, flagging the closing time", () => {
      expect(
        flaggedField(details({ operatingHoursStart: "09:00", operatingHoursEnd: "09:00" })),
      ).toBe("operatingHoursEnd");
    });

    it("refuses closing earlier than it opens, flagging the closing time", () => {
      expect(
        flaggedField(details({ operatingHoursStart: "17:00", operatingHoursEnd: "08:30" })),
      ).toBe("operatingHoursEnd");
    });

    it("accepts closing one minute after opening", () => {
      expect(() =>
        defineVenue(details({ operatingHoursStart: "09:00", operatingHoursEnd: "09:01" })),
      ).not.toThrow();
    });

    it("refuses a time that is not HH:MM", () => {
      expect(flaggedField(details({ operatingHoursStart: "8am" }))).toBe("operatingHoursStart");
    });
  });
});

describe("canMaintainVenues (SPM-148)", () => {
  it("allows Venue Staff", () => {
    expect(canMaintainVenues(["Venue Staff"])).toBe(true);
  });

  it.each([
    "Event Organiser",
    "Event Coordinator",
    "Event Operations Manager",
    "Technical Support Staff",
    "Attendee",
  ])("refuses %s", (role) => {
    expect(canMaintainVenues([role])).toBe(false);
  });

  it("refuses someone with no role", () => {
    expect(canMaintainVenues([])).toBe(false);
  });
});
