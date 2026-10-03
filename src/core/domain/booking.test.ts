import { describe, expect, it } from "vitest";

import {
  chooseRoomLayout,
  requestVenueBooking,
  type BookingStatus,
  type OccupiedSlot,
  type SlotOnDate,
} from "./booking";
import {
  DuplicateBookingSlotError,
  InvalidBookingDateError,
  NoBookingSlotsError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueSlotUnavailableError,
} from "./errors";
import { userAccountId } from "./user-account";
import { venueId, type Venue } from "./venue";

const THEATRE = "Theatre";
const CLASSROOM = "Classroom";
const BANQUET = "Banquet";

function venue(layouts: readonly string[] = [THEATRE, CLASSROOM]): Venue {
  return {
    id: venueId("venue-1"),
    location: "Harbour Hall",
    facilities: null,
    accessibility: null,
    operatingHoursStart: null,
    operatingHoursEnd: null,
    capacity: null,
    bookingHorizonDays: null,
    layouts: layouts.map((name) => ({ name, capacity: 100 })),
  };
}

function occupied(date: string, slot: SlotOnDate["slot"], status: BookingStatus): OccupiedSlot {
  return { date, slot, status };
}

function request(
  slots: readonly SlotOnDate[],
  existing: readonly OccupiedSlot[] = [],
  layout: string | null = THEATRE,
) {
  return requestVenueBooking({
    eventId: "event-1",
    venue: venue(),
    roomLayout: layout,
    slots,
    requestedBy: userAccountId("coordinator-1"),
    occupied: existing,
  });
}

describe("requestVenueBooking (SPM-46)", () => {
  it("records one venue, one slot and the event as a Requested booking (AC1)", () => {
    expect(request([{ date: "2026-10-05", slot: "AM" }])).toEqual({
      eventId: "event-1",
      venueId: "venue-1",
      roomLayout: THEATRE,
      slots: [{ date: "2026-10-05", slot: "AM" }],
      requestedBy: "coordinator-1",
      status: "Requested",
    });
  });

  it("takes several slots on several days, in date then slot order (AC1)", () => {
    const booking = request([
      { date: "2026-10-06", slot: "AM" },
      { date: "2026-10-05", slot: "Night" },
      { date: "2026-10-05", slot: "AM" },
    ]);

    expect(booking.slots).toEqual([
      { date: "2026-10-05", slot: "AM" },
      { date: "2026-10-05", slot: "Night" },
      { date: "2026-10-06", slot: "AM" },
    ]);
  });

  it("refuses a request with no slots", () => {
    expect(() => request([])).toThrow(NoBookingSlotsError);
  });

  it("refuses the same slot on the same day twice", () => {
    expect(() =>
      request([
        { date: "2026-10-05", slot: "PM" },
        { date: "2026-10-05", slot: "PM" },
      ]),
    ).toThrow(DuplicateBookingSlotError);
  });

  it.each(["2026-02-30", "2026-13-01", "05/10/2026", ""])(
    "refuses %j, which is not a calendar date",
    (date) => {
      expect(() => request([{ date, slot: "AM" }])).toThrow(InvalidBookingDateError);
    },
  );

  it("blocks outright a slot that already carries a Confirmed booking at the venue (AC4)", () => {
    expect(() =>
      request([{ date: "2026-10-05", slot: "PM" }], [occupied("2026-10-05", "PM", "Confirmed")]),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("names only the clashing slots when some of a multi-slot request are free (AC4)", () => {
    let caught: unknown;
    try {
      request(
        [
          { date: "2026-10-05", slot: "AM" },
          { date: "2026-10-05", slot: "PM" },
          { date: "2026-10-06", slot: "AM" },
        ],
        [occupied("2026-10-05", "PM", "Confirmed"), occupied("2026-10-06", "AM", "Confirmed")],
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VenueSlotUnavailableError);
    expect((caught as VenueSlotUnavailableError).slots).toEqual([
      { date: "2026-10-05", slot: "PM" },
      { date: "2026-10-06", slot: "AM" },
    ]);
  });

  it("blocks a slot on tentative hold too -- one hold or booking per slot (#41)", () => {
    expect(() =>
      request([{ date: "2026-10-05", slot: "AM" }], [occupied("2026-10-05", "AM", "Tentative Hold")]),
    ).toThrow(VenueSlotUnavailableError);
  });

  it.each<BookingStatus>(["Requested", "Rejected", "Released", "Cancelled"])(
    "does not block on a %s booking of the same slot -- it holds nothing",
    (status) => {
      expect(
        request([{ date: "2026-10-05", slot: "AM" }], [occupied("2026-10-05", "AM", status)]).status,
      ).toBe("Requested");
    },
  );

  it("allows the adjacent slot to a Confirmed booking (buffers are a known gap, #123)", () => {
    expect(
      request([{ date: "2026-10-05", slot: "PM" }], [occupied("2026-10-05", "AM", "Confirmed")])
        .slots,
    ).toEqual([{ date: "2026-10-05", slot: "PM" }]);
  });

  it("allows the same slot on a different day", () => {
    expect(
      request([{ date: "2026-10-06", slot: "AM" }], [occupied("2026-10-05", "AM", "Confirmed")])
        .status,
    ).toBe("Requested");
  });

  it("needs a layout when the venue supports more than one (AC2)", () => {
    expect(() => request([{ date: "2026-10-05", slot: "AM" }], [], null)).toThrow(
      RoomLayoutRequiredError,
    );
  });
});

describe("chooseRoomLayout (SPM-104)", () => {
  it("records the chosen layout as a reference to one the venue supports (AC1)", () => {
    expect(chooseRoomLayout(venue([THEATRE, CLASSROOM]), CLASSROOM)).toBe(CLASSROOM);
  });

  it("refuses a layout the venue does not support", () => {
    expect(() => chooseRoomLayout(venue([THEATRE, CLASSROOM]), BANQUET)).toThrow(
      UnsupportedRoomLayoutError,
    );
  });

  it("requires a choice when the venue supports more than one layout (AC2)", () => {
    expect(() => chooseRoomLayout(venue([THEATRE, CLASSROOM]), null)).toThrow(
      RoomLayoutRequiredError,
    );
  });

  it("takes a single-layout venue's only layout when none is given", () => {
    expect(chooseRoomLayout(venue([THEATRE]), null)).toBe(THEATRE);
  });

  it("refuses another layout for a single-layout venue", () => {
    expect(() => chooseRoomLayout(venue([THEATRE]), CLASSROOM)).toThrow(UnsupportedRoomLayoutError);
  });

  it("records no layout when the venue has none on record", () => {
    expect(chooseRoomLayout(venue([]), null)).toBeNull();
  });
});
