import { describe, expect, it } from "vitest";

import type { BookingStatus } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import { EventNotAwaitingSafetyCheckError, SafetyCheckCommentsRequiredError } from "./errors";
import { eventId } from "./event";
import {
  awaitsSafetyCheck,
  canResubmitForSafetyCheck,
  confirmedVenues,
  entersSafetyCheck,
  recordSafetyCheck,
  safetyCheckBlocker,
  type SafetyCheckBooking,
  type SafetyCheckCandidate,
  type SafetyCheckEquipmentLine,
} from "./safety-check";
import { userAccountId } from "./user-account";

function booking(overrides: Partial<SafetyCheckBooking> = {}): SafetyCheckBooking {
  return { status: "Confirmed", venueName: "Grand Ballroom", ...overrides };
}

/** Essential unless a case says otherwise, so the SPM-259 cases keep testing a line that counts. */
function line(overrides: Partial<SafetyCheckEquipmentLine> = {}): SafetyCheckEquipmentLine {
  return { state: "Reserved", quantityRequested: 2, quantityReserved: 2, essential: true, ...overrides };
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
    checked: false,
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

describe("awaitsSafetyCheck with essential lines (SPM-319)", () => {
  const optional = (overrides: Partial<SafetyCheckEquipmentLine> = {}) => line({ essential: false, ...overrides });

  it.each<[string, Partial<SafetyCheckEquipmentLine>]>([
    ["not reserved yet", { state: "Requested", quantityReserved: 0 }],
    ["under review", { state: "Under review", quantityReserved: 0 }],
    ["reserved in part", { quantityRequested: 3, quantityReserved: 2 }],
    ["unfulfilled", { state: "Unfulfilled", quantityReserved: 0 }],
  ])("AC1: lists an event whose only gap is a non-essential line %s", (_gap, gap) => {
    expect(awaitsSafetyCheck(candidate({ equipmentLines: [line(), optional(gap)] }))).toBe(true);
  });

  it("AC1: still needs the venue rule: a non-essential gap does not list an event with a booking on hold", () => {
    expect(
      awaitsSafetyCheck(
        candidate({
          bookings: [booking(), booking({ status: "Tentative Hold" })],
          equipmentLines: [line(), optional({ state: "Requested", quantityReserved: 0 })],
        }),
      ),
    ).toBe(false);
  });

  it("AC2: leaves out an event with one essential line not reserved, beside essential lines that are", () => {
    expect(
      awaitsSafetyCheck(
        candidate({ equipmentLines: [line(), line({ state: "Requested", quantityReserved: 0 }), optional()] }),
      ),
    ).toBe(false);
  });

  it.each([
    { reserved: 2, listed: false },
    { reserved: 3, listed: true },
    { reserved: 4, listed: true },
  ])("AC2: an essential line with 3 requested and $reserved reserved lists the event: $listed", ({ reserved, listed }) => {
    expect(
      awaitsSafetyCheck(
        candidate({ equipmentLines: [line({ quantityRequested: 3, quantityReserved: reserved })] }),
      ),
    ).toBe(listed);
  });

  it("AC3: an unmarked line counts as non-essential, so an event with no essential line is listed whatever its equipment", () => {
    expect(
      awaitsSafetyCheck(
        candidate({
          equipmentLines: [
            optional({ state: "Requested", quantityReserved: 0 }),
            optional({ state: "Under review", quantityReserved: 0 }),
          ],
        }),
      ),
    ).toBe(true);
  });

  it("AC3: marking the only unreserved line non-essential puts the event on the list, as the safety watch sees it", () => {
    const gap = { state: "Requested", quantityReserved: 0 } as const;
    expect(
      entersSafetyCheck(
        candidate({ equipmentLines: [line(), line(gap)] }),
        candidate({ equipmentLines: [line(), optional(gap)] }),
      ),
    ).toBe(true);
  });
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

describe("entersSafetyCheck (SPM-262)", () => {
  const notReady = candidate({ bookings: [booking(), booking({ status: "Requested" })] });

  it("AC1, AC2: an event that did not await a check and now does has entered the list", () => {
    expect(entersSafetyCheck(notReady, candidate())).toBe(true);
  });

  it("AC3: an event that still does not await a check has not entered", () => {
    expect(entersSafetyCheck(notReady, notReady)).toBe(false);
  });

  it("AC3: an event already on the list has not entered again", () => {
    expect(entersSafetyCheck(candidate(), candidate())).toBe(false);
  });

  it("AC3: an event that leaves the list has not entered", () => {
    expect(entersSafetyCheck(candidate(), notReady)).toBe(false);
  });

  it("AC3: no event after the change has not entered", () => {
    expect(entersSafetyCheck(notReady, null)).toBe(false);
  });
});

describe("awaitsSafetyCheck once checked (SPM-260)", () => {
  it("AC6: leaves out an event that already has an outcome, even with its arrangements confirmed", () => {
    expect(awaitsSafetyCheck(candidate({ checked: true }))).toBe(false);
  });
});

describe("recordSafetyCheck (SPM-260)", () => {
  const OFFICER = userAccountId("safety-1");

  it("AC2, AC4: approves with no comments", () => {
    expect(recordSafetyCheck(candidate(), "Approved", "", OFFICER)).toEqual({
      eventId: "event-1",
      outcome: "Approved",
      comments: null,
      checkedBy: "safety-1",
    });
  });

  it("AC4: keeps an approval's comments, trimmed", () => {
    expect(recordSafetyCheck(candidate(), "Approved", "  Keep the fire exit clear.  ", OFFICER).comments).toBe(
      "Keep the fire exit clear.",
    );
  });

  it("AC2, AC3: rejects with the comments saying what must change, trimmed", () => {
    expect(
      recordSafetyCheck(candidate(), "Rejected", "  Grand Ballroom: 220 expected, banquet layout holds 180.\n", OFFICER),
    ).toEqual({
      eventId: "event-1",
      outcome: "Rejected",
      comments: "Grand Ballroom: 220 expected, banquet layout holds 180.",
      checkedBy: "safety-1",
    });
  });

  it.each(["", "   ", "\n\t "])("AC3: refuses a rejection whose comments are %j", (comments) => {
    expect(() => recordSafetyCheck(candidate(), "Rejected", comments, OFFICER)).toThrow(
      SafetyCheckCommentsRequiredError,
    );
  });

  it("AC3: accepts a rejection with a single character of comment", () => {
    expect(recordSafetyCheck(candidate(), "Rejected", "x", OFFICER).comments).toBe("x");
  });

  it("AC6: refuses an outcome on an event that has already been checked", () => {
    expect(() => recordSafetyCheck(candidate({ checked: true }), "Approved", "", OFFICER)).toThrow(
      EventNotAwaitingSafetyCheckError,
    );
  });

  it("AC6: refuses an outcome on an event whose arrangements are not all confirmed", () => {
    const notReady = candidate({ bookings: [booking(), booking({ status: "Tentative Hold" })] });
    expect(() => recordSafetyCheck(notReady, "Approved", "", OFFICER)).toThrow(EventNotAwaitingSafetyCheckError);
  });

  it("AC6: says the event is not awaiting a check before asking for comments", () => {
    expect(() => recordSafetyCheck(candidate({ checked: true }), "Rejected", "", OFFICER)).toThrow(
      EventNotAwaitingSafetyCheckError,
    );
  });
});

describe("canResubmitForSafetyCheck (SPM-261)", () => {
  const rejected = { outcome: "Rejected" as const, resubmittedAt: null };

  it("AC3: offers a Planning event whose latest check is a rejection not yet resubmitted", () => {
    expect(canResubmitForSafetyCheck("Planning", rejected)).toBe(true);
  });

  it("AC3: does not offer an event whose latest check is an approval", () => {
    expect(canResubmitForSafetyCheck("Planning", { outcome: "Approved", resubmittedAt: null })).toBe(false);
  });

  it("AC3: does not offer an event already resubmitted", () => {
    expect(canResubmitForSafetyCheck("Planning", { ...rejected, resubmittedAt: "2026-10-06T10:00:00.000Z" })).toBe(
      false,
    );
  });

  it("AC3: does not offer an event with no check yet", () => {
    expect(canResubmitForSafetyCheck("Planning", null)).toBe(false);
  });

  it.each<CoordinatorEventStatus>(["Blocked", "Confirmed", "Completed", "Cancelled"])(
    "AC3: does not offer a %s event, even after a rejection",
    (status) => {
      expect(canResubmitForSafetyCheck(status, rejected)).toBe(false);
    },
  );
});

describe("safetyCheckBlocker (SPM-264)", () => {
  it("AC1: blocks an event with no check yet", () => {
    expect(safetyCheckBlocker(null)).toBe("no-check");
  });

  it("AC2: blocks an event whose latest check is a rejection not yet resubmitted", () => {
    expect(safetyCheckBlocker({ outcome: "Rejected", resubmittedAt: null })).toBe("rejected");
  });

  it("AC3: blocks an event resubmitted and awaiting a fresh check", () => {
    expect(safetyCheckBlocker({ outcome: "Rejected", resubmittedAt: "2026-10-06T10:00:00.000Z" })).toBe(
      "awaiting-recheck",
    );
  });

  it("AC4/AC5: does not block an event whose latest check is an approval", () => {
    expect(safetyCheckBlocker({ outcome: "Approved", resubmittedAt: null })).toBeNull();
  });
});
