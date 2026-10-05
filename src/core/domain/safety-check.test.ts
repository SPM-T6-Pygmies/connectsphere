import { describe, expect, it } from "vitest";

import type { BookingStatus } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import { eventId } from "./event";
import {
  awaitsSafetyCheck,
  confirmedVenues,
  type SafetyCheckBooking,
  type SafetyCheckCandidate,
  type SafetyCheckEquipmentLine,
} from "./safety-check";

function booking(overrides: Partial<SafetyCheckBooking> = {}): SafetyCheckBooking {
  return { status: "Confirmed", venueName: "Grand Ballroom", ...overrides };
}

function line(overrides: Partial<SafetyCheckEquipmentLine> = {}): SafetyCheckEquipmentLine {
  return { state: "Reserved", quantityRequested: 2, quantityReserved: 2, ...overrides };
}

function candidate(overrides: Partial<SafetyCheckCandidate> = {}): SafetyCheckCandidate {
  return {
    event: {
      id: eventId("event-1"),
      name: "Founders' Gala Dinner",
      status: "Planning",
      preferredDate: "2026-12-12",
      expectedAttendance: 120,
    },
    bookings: [booking()],
    equipmentLines: [line()],
    ...overrides,
  };
}

describe("awaitsSafetyCheck (SPM-259)", () => {
  it("AC1: lists a Planning event whose bookings are all Confirmed and whose lines are all reserved in full", () => {
    expect(awaitsSafetyCheck(candidate())).toBe(true);
  });

  it("AC1: counts a booking on one of the event's sessions like one on the event", () => {
    // The store hands over both kinds as one list, so two Confirmed bookings stand for that.
    expect(awaitsSafetyCheck(candidate({ bookings: [booking(), booking({ venueName: "Room 2" })] }))).toBe(true);
  });

  it("AC2: lists an event with no equipment lines on its venue bookings alone", () => {
    expect(awaitsSafetyCheck(candidate({ equipmentLines: [] }))).toBe(true);
  });

  it.each<BookingStatus>(["Requested", "Tentative Hold"])(
    "AC3: leaves out an event with a %s booking beside a Confirmed one",
    (status) => {
      expect(awaitsSafetyCheck(candidate({ bookings: [booking(), booking({ status })] }))).toBe(false);
    },
  );

  it.each<BookingStatus>(["Rejected", "Released", "Cancelled"])(
    "AC3: ignores a %s booking beside a Confirmed one",
    (status) => {
      expect(awaitsSafetyCheck(candidate({ bookings: [booking(), booking({ status })] }))).toBe(true);
    },
  );

  it("AC3: leaves out an event with no venue booking at all", () => {
    expect(awaitsSafetyCheck(candidate({ bookings: [] }))).toBe(false);
  });

  it("AC3: leaves out an event whose only bookings are no longer live", () => {
    expect(
      awaitsSafetyCheck(candidate({ bookings: [booking({ status: "Rejected" }), booking({ status: "Released" })] })),
    ).toBe(false);
  });

  it("AC3: leaves out an event with a line Technical Support have not reserved", () => {
    expect(
      awaitsSafetyCheck(
        candidate({ equipmentLines: [line(), line({ state: "Requested", quantityReserved: 0 })] }),
      ),
    ).toBe(false);
  });

  it("AC3: leaves out an event with a line under review", () => {
    expect(awaitsSafetyCheck(candidate({ equipmentLines: [line({ state: "Under review" })] }))).toBe(false);
  });

  it.each([
    { reserved: 2, listed: false },
    { reserved: 3, listed: true },
    { reserved: 4, listed: true },
  ])("AC3: with 3 requested and $reserved reserved, listed is $listed", ({ reserved, listed }) => {
    expect(
      awaitsSafetyCheck(
        candidate({ equipmentLines: [line({ quantityRequested: 3, quantityReserved: reserved })] }),
      ),
    ).toBe(listed);
  });

  it.each<CoordinatorEventStatus>(["Blocked", "Confirmed", "Completed", "Cancelled"])(
    "AC4: leaves out a %s event even when its arrangements are confirmed",
    (status) => {
      const ready = candidate();
      expect(awaitsSafetyCheck({ ...ready, event: { ...ready.event, status } })).toBe(false);
    },
  );
});

describe("confirmedVenues (SPM-259)", () => {
  it("AC5: names each Confirmed booking's venue once, alphabetically, and skips bookings no longer live", () => {
    expect(
      confirmedVenues(
        candidate({
          bookings: [
            booking({ venueName: "Sky Terrace" }),
            booking({ venueName: "Grand Ballroom" }),
            booking({ venueName: "Sky Terrace" }),
            booking({ status: "Released", venueName: "Old Hall" }),
          ],
        }),
      ),
    ).toEqual(["Grand Ballroom", "Sky Terrace"]);
  });
});
