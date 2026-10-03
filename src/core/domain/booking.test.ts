import { describe, expect, it } from "vitest";

import { RoomLayoutRequiredError, UnsupportedRoomLayoutError } from "./errors";
import { venueId, type Venue } from "./venue";
import { checkLayoutCapacity, chooseRoomLayout, layoutFromSearch } from "./booking";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: venueId("v1"),
    location: "Harbour Hall",
    facilities: "Projector",
    accessibility: "Step-free access",
    operatingHoursStart: "09:00",
    operatingHoursEnd: "18:00",
    // Deliberately unlike every layout figure: nothing below may read it (SPM-106).
    capacity: 999,
    bookingHorizonDays: 60,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Boardroom", capacity: 20 },
    ],
    ...overrides,
  };
}

describe("chooseRoomLayout (SPM-104)", () => {
  it("accepts a layout the venue supports", () => {
    expect(chooseRoomLayout(venue(), "Theatre")).toBe("Theatre");
  });

  it("trims the layout name before matching it", () => {
    expect(chooseRoomLayout(venue(), "  Boardroom ")).toBe("Boardroom");
  });

  it("refuses a booking with no layout -- it could not be checked for capacity", () => {
    expect(() => chooseRoomLayout(venue(), null)).toThrow(RoomLayoutRequiredError);
    expect(() => chooseRoomLayout(venue(), "   ")).toThrow(RoomLayoutRequiredError);
  });

  it("requires a layout even when the venue supports only one", () => {
    const single = venue({ layouts: [{ name: "Theatre", capacity: 200 }] });
    expect(() => chooseRoomLayout(single, null)).toThrow(RoomLayoutRequiredError);
  });

  it("refuses a layout the venue does not support", () => {
    expect(() => chooseRoomLayout(venue(), "Banquet")).toThrow(UnsupportedRoomLayoutError);
  });

  it("does not accept free text that merely resembles a layout", () => {
    expect(() => chooseRoomLayout(venue(), "theatre")).toThrow(UnsupportedRoomLayoutError);
    expect(() => chooseRoomLayout(venue(), "Theatre-ish")).toThrow(UnsupportedRoomLayoutError);
  });
});

describe("checkLayoutCapacity (SPM-104)", () => {
  it("compares attendance with the chosen layout's capacity, not the venue-wide figure", () => {
    const result = checkLayoutCapacity(venue(), "Boardroom", 100);

    expect(result).toEqual({
      layout: "Boardroom",
      capacity: 20,
      expectedAttendance: 100,
      withinCapacity: false,
    });
  });

  it("reads the other layout's figure when the other layout is chosen", () => {
    const result = checkLayoutCapacity(venue(), "Theatre", 100);

    expect(result.capacity).toBe(200);
    expect(result.withinCapacity).toBe(true);
  });

  it("is within capacity exactly at the layout's figure", () => {
    expect(checkLayoutCapacity(venue(), "Boardroom", 20).withinCapacity).toBe(true);
  });

  it("is not within capacity one above the layout's figure", () => {
    expect(checkLayoutCapacity(venue(), "Boardroom", 21).withinCapacity).toBe(false);
  });

  it("is within capacity one below the layout's figure", () => {
    expect(checkLayoutCapacity(venue(), "Boardroom", 19).withinCapacity).toBe(true);
  });

  it("gives no verdict when the event has no expected attendance yet", () => {
    const result = checkLayoutCapacity(venue(), "Theatre", null);

    expect(result).toEqual({
      layout: "Theatre",
      capacity: 200,
      expectedAttendance: null,
      withinCapacity: null,
    });
  });

  it("refuses a layout the venue no longer supports", () => {
    expect(() => checkLayoutCapacity(venue(), "Banquet", 10)).toThrow(UnsupportedRoomLayoutError);
  });
});

describe("layoutFromSearch (SPM-104)", () => {
  it("carries the layout a search matched on forward as the default", () => {
    expect(layoutFromSearch(venue(), "Theatre")).toBe("Theatre");
  });

  it("offers no default when the search named no layout", () => {
    expect(layoutFromSearch(venue(), null)).toBeNull();
  });

  it("offers no default when the venue does not support the searched layout", () => {
    expect(layoutFromSearch(venue(), "Banquet")).toBeNull();
  });
});
