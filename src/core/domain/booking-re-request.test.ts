import { describe, expect, it } from "vitest";

import {
  decideBooking,
  requestVenueBooking,
  type BookingForDecision,
  type BookingId,
  type BookingStatus,
  type OccupiedTime,
} from "./booking";
import { bookingToReplace, reRequestDraft, reRequestPending } from "./booking-review-flag";
import {
  CancelledEventBookingError,
  NoFlagToReRequestError,
  ReRequestNotHoldableError,
  ReRequestPendingError,
  VenueSlotUnavailableError,
} from "./errors";
import { userAccountId } from "./user-account";
import { venueId, type Venue } from "./venue";

const NOW = new Date("2026-10-26T09:00:00+08:00");
const FLAGGED = "812" as BookingId;
const OTHER = "813" as BookingId;

const HALL: Venue = {
  id: venueId("5"),
  location: "Main Hall",
  facilities: null,
  accessibility: null,
  openingHours: [{ start: "00:00", end: "24:00" }],
  capacity: null,
  bookingHorizonDays: null,
  layouts: [{ name: "Theatre", capacity: 200 }],
};

function taken(bookingId: string, start: string, end: string): OccupiedTime {
  return { bookingId, date: "2026-11-16", start, end, status: "Confirmed", holdExpiresAt: null };
}

function reRequest(
  occupied: readonly OccupiedTime[],
  start = "13:00",
  end = "18:00",
  eventStatus: "Planning" | "Cancelled" = "Planning",
) {
  return requestVenueBooking({
    eventId: "41",
    eventStatus,
    venue: HALL,
    roomLayout: "Theatre",
    times: [{ date: "2026-11-16", start, end }],
    requestedBy: userAccountId("2"),
    occupied,
    now: NOW,
    replacing: FLAGGED,
  });
}

describe("bookingToReplace (SPM-251)", () => {
  const flag = { bookingId: FLAGGED };
  const waiting = (status: BookingStatus, replacesBookingId: string | null = FLAGGED) => ({
    status,
    replacesBookingId,
  });

  it("AC1: a booking with an open flag can be re-requested", () => {
    expect(bookingToReplace([flag], [], FLAGGED)).toBe(FLAGGED);
  });

  it("AC1: a booking with no open flag cannot, even when another booking on the event has one", () => {
    expect(() => bookingToReplace([], [], FLAGGED)).toThrow(NoFlagToReRequestError);
    expect(() => bookingToReplace([{ bookingId: OTHER }], [], FLAGGED)).toThrow(
      "This booking has no open flag to re-request.",
    );
  });

  it("AC9: a second re-request is refused while one waits for Venue Staff", () => {
    expect(() => bookingToReplace([flag], [waiting("Requested")], FLAGGED)).toThrow(ReRequestPendingError);
    expect(() => bookingToReplace([flag], [waiting("Requested")], FLAGGED)).toThrow(
      "A re-request for this booking is already waiting for Venue Staff.",
    );
  });

  it("AC7: once the re-request is rejected the booking can be re-requested again", () => {
    expect(bookingToReplace([flag], [waiting("Rejected")], FLAGGED)).toBe(FLAGGED);
  });

  it("AC8: a waiting re-request for another booking does not stop this one", () => {
    expect(bookingToReplace([flag], [waiting("Requested", OTHER), waiting("Confirmed", null)], FLAGGED)).toBe(
      FLAGGED,
    );
  });

  it("AC9: only a Requested re-request counts as waiting", () => {
    expect(reRequestPending([waiting("Requested")], FLAGGED)).toBe(true);
    for (const status of ["Rejected", "Confirmed", "Released", "Cancelled"] as const) {
      expect(reRequestPending([waiting(status)], FLAGGED)).toBe(false);
    }
  });
});

describe("requestVenueBooking replacing a flagged booking (SPM-251)", () => {
  it("AC4: is an ordinary Requested booking that names the booking it replaces", () => {
    expect(reRequest([])).toMatchObject({ status: "Requested", venueId: "5", replacesBookingId: FLAGGED });
  });

  it("AC5: the same venue at an overlapping time does not clash with the booking it replaces", () => {
    expect(reRequest([taken(FLAGGED, "13:00", "18:00")]).times).toEqual([
      { date: "2026-11-16", start: "13:00", end: "18:00" },
    ]);
  });

  it("AC5: any other booking still clashes, by as little as 15 minutes", () => {
    expect(() => reRequest([taken(FLAGGED, "13:00", "18:00"), taken(OTHER, "17:45", "20:00")])).toThrow(
      VenueSlotUnavailableError,
    );
  });

  it("AC5: another booking that only touches it does not clash", () => {
    expect(reRequest([taken(FLAGGED, "13:00", "18:00"), taken(OTHER, "18:00", "20:00")]).status).toBe(
      "Requested",
    );
  });

  it("AC4: a cancelled event takes no re-request either", () => {
    expect(() => reRequest([], "13:00", "18:00", "Cancelled")).toThrow(CancelledEventBookingError);
  });

  it("an ordinary request replaces nothing and still clashes with every booking", () => {
    const ordinary = {
      eventId: "41",
      eventStatus: "Planning" as const,
      venue: HALL,
      roomLayout: "Theatre",
      times: [{ date: "2026-11-16", start: "13:00", end: "18:00" }],
      requestedBy: userAccountId("2"),
      now: NOW,
    };
    expect(requestVenueBooking({ ...ordinary, occupied: [] }).replacesBookingId).toBeNull();
    expect(() => requestVenueBooking({ ...ordinary, occupied: [taken(FLAGGED, "13:00", "18:00")] })).toThrow(
      VenueSlotUnavailableError,
    );
  });
});

describe("decideBooking on a re-request (SPM-251)", () => {
  const staff = userAccountId("9");
  const reRequested: BookingForDecision = {
    id: "900" as BookingId,
    venueId: venueId("5"),
    status: "Requested",
    times: [{ date: "2026-11-16", start: "13:00", end: "18:00" }],
    replaces: { id: FLAGGED },
  };

  it("AC10: Venue Staff cannot put a re-request on hold", () => {
    expect(() => decideBooking(reRequested, { kind: "hold" }, staff, NOW)).toThrow(ReRequestNotHoldableError);
    expect(() => decideBooking(reRequested, { kind: "hold" }, staff, NOW)).toThrow(
      "A re-request can only be approved or rejected, not held.",
    );
  });

  it("AC6: approving confirms it", () => {
    expect(decideBooking(reRequested, { kind: "approve" }, staff, NOW).status).toBe("Confirmed");
  });

  it("AC7: rejecting it needs a reason, as for any request", () => {
    expect(
      decideBooking(reRequested, { kind: "reject", reason: "Hall closed", suggestedAlternative: null }, staff, NOW)
        .status,
    ).toBe("Rejected");
  });

  it("AC10: an ordinary request can still be held", () => {
    expect(decideBooking({ ...reRequested, replaces: null }, { kind: "hold" }, staff, NOW).status).toBe(
      "Tentative Hold",
    );
  });
});

describe("reRequestDraft (SPM-251)", () => {
  const flagged = {
    venueId: venueId("5"),
    roomLayoutName: "Theatre",
    times: [{ date: "2026-11-16", start: "13:00", end: "18:00" }],
  };
  const hall = { layouts: [{ name: "Theatre", capacity: 200 }, { name: "Banquet", capacity: 120 }] };
  const moved = [
    { date: "2026-11-17", start: "09:00", end: "12:00" },
    { date: "2026-11-18", start: "09:00", end: "12:00" },
  ];

  it("AC2: starts at the booking's venue, from the event's current times, one per date", () => {
    expect(reRequestDraft({ times: moved, roomLayoutPreference: null }, flagged, hall)).toEqual({
      venueId: "5",
      roomLayout: "Theatre",
      times: moved,
    });
  });

  it("AC2: falls back to the booking's own times when the event has none", () => {
    expect(reRequestDraft({ times: [], roomLayoutPreference: null }, flagged, hall).times).toEqual(flagged.times);
  });

  it("AC2: takes the event's layout preference when the venue supports it, whatever its case", () => {
    expect(reRequestDraft({ times: moved, roomLayoutPreference: " banquet" }, flagged, hall).roomLayout).toBe("Banquet");
  });

  it("AC2: keeps the booking's layout when the venue does not support the preference", () => {
    expect(reRequestDraft({ times: moved, roomLayoutPreference: "Cabaret" }, flagged, hall).roomLayout).toBe("Theatre");
  });

  it("AC2: takes a venue's only layout, and none when nothing fits a venue with several", () => {
    const noLayout = { ...flagged, roomLayoutName: null };
    expect(reRequestDraft({ times: moved, roomLayoutPreference: null }, noLayout, { layouts: [{ name: "Classroom", capacity: 30 }] }).roomLayout).toBe(
      "Classroom",
    );
    expect(reRequestDraft({ times: moved, roomLayoutPreference: null }, noLayout, hall).roomLayout).toBeNull();
    expect(reRequestDraft({ times: moved, roomLayoutPreference: null }, noLayout, undefined).roomLayout).toBeNull();
  });
});
