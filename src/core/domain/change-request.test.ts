import { describe, expect, it } from "vitest";

import {
  assertCanSubmitChangeRequest,
  changeRequestStateFor,
  chooseRequestedChanges,
  type ChangeRequestTarget,
  type RequestedChange,
} from "./change-request";
import type { CoordinatorEventStatus } from "./coordinator-event";
import {
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  EventRequestNotFoundError,
  InvalidChangeRequestError,
} from "./errors";
import { eventId } from "./event";
import { userAccountId } from "./user-account";

const owner = userAccountId("6");
const colleague = userAccountId("7");

function target(overrides: Partial<ChangeRequestTarget> = {}): ChangeRequestTarget {
  return {
    eventId: eventId("2"),
    status: "Confirmed",
    owningOrganiserUserAccountId: owner,
    hasOpenChangeRequest: false,
    ...overrides,
  };
}

const allFive: RequestedChange[] = [
  { field: "times", value: [{ date: "2026-12-01", start: "09:00", end: "12:00" }] },
  { field: "venue_requirements", value: "Theatre seating for 150" },
  { field: "expected_attendance", value: 150 },
  { field: "equipment_requirements", value: "Two wireless mics" },
  { field: "registration", value: { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-25" } },
];

describe("changeRequestStateFor (SPM-52)", () => {
  it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Confirmed"])(
    "AC3: a %s event the Organiser owns is open to a change request",
    (status) => {
      expect(changeRequestStateFor(target({ status }), owner)).toBe("available");
    },
  );

  it.each<CoordinatorEventStatus>(["Completed", "Cancelled"])("a %s event is closed to change requests", (status) => {
    expect(changeRequestStateFor(target({ status }), owner)).toBe("closed");
  });

  it("AC4: a colleague in the same organisation who does not own the event gets none", () => {
    expect(changeRequestStateFor(target(), colleague)).toBe("none");
  });

  it("AC4: a request with no event yet gets none", () => {
    expect(changeRequestStateFor(null, owner)).toBe("none");
  });

  it("is open while an earlier change request waits on the Coordinator", () => {
    expect(changeRequestStateFor(target({ hasOpenChangeRequest: true }), owner)).toBe("open");
  });
});

describe("assertCanSubmitChangeRequest (SPM-52)", () => {
  it("AC3: lets the owner submit against a Confirmed event", () => {
    expect(() => assertCanSubmitChangeRequest(target(), owner, "7")).not.toThrow();
  });

  it("AC4: refuses a non-owner as not found, so a guess cannot confirm the event exists", () => {
    expect(() => assertCanSubmitChangeRequest(target(), colleague, "7")).toThrow(EventRequestNotFoundError);
  });

  it("refuses a Completed event", () => {
    expect(() => assertCanSubmitChangeRequest(target({ status: "Completed" }), owner, "7")).toThrow(
      ChangeRequestClosedError,
    );
  });

  it("refuses a second open change request on the same event", () => {
    expect(() => assertCanSubmitChangeRequest(target({ hasOpenChangeRequest: true }), owner, "7")).toThrow(
      ChangeRequestAlreadyOpenError,
    );
  });
});

describe("chooseRequestedChanges (SPM-52)", () => {
  it("AC1: accepts one field with its new value", () => {
    expect(chooseRequestedChanges([{ field: "expected_attendance", value: 120 }])).toEqual([
      { field: "expected_attendance", value: 120 },
    ]);
  });

  it("AC1, AC2: accepts all five significant fields in one request", () => {
    expect(chooseRequestedChanges(allFive)).toEqual(allFive);
  });

  it("AC1: refuses a request with no fields", () => {
    expect(() => chooseRequestedChanges([])).toThrow(InvalidChangeRequestError);
  });

  it("AC1: refuses the same field twice", () => {
    expect(() =>
      chooseRequestedChanges([
        { field: "expected_attendance", value: 120 },
        { field: "expected_attendance", value: 130 },
      ]),
    ).toThrow(InvalidChangeRequestError);
  });

  it("accepts Not applicable for equipment and registration", () => {
    expect(
      chooseRequestedChanges([
        { field: "equipment_requirements", value: null },
        { field: "registration", value: null },
      ]),
    ).toEqual([
      { field: "equipment_requirements", value: null },
      { field: "registration", value: null },
    ]);
  });

  it("trims text and refuses blank text", () => {
    expect(chooseRequestedChanges([{ field: "venue_requirements", value: "  Stage  " }])).toEqual([
      { field: "venue_requirements", value: "Stage" },
    ]);
    expect(() => chooseRequestedChanges([{ field: "equipment_requirements", value: "   " }])).toThrow(
      InvalidChangeRequestError,
    );
  });

  it.each([
    [-1, false],
    [0, true],
    [1, true],
    [1.5, false],
  ])("expected attendance %s is accepted: %s", (value, accepted) => {
    const choose = () => chooseRequestedChanges([{ field: "expected_attendance", value }]);
    if (accepted) {
      expect(choose()).toEqual([{ field: "expected_attendance", value }]);
    } else {
      expect(choose).toThrow(InvalidChangeRequestError);
    }
  });

  it("points a registration window that runs backwards at the registration field", () => {
    expect(() =>
      chooseRequestedChanges([
        { field: "registration", value: { enabled: true, opensOn: "2026-11-25", closesOn: "2026-11-01" } },
      ]),
    ).toThrow(expect.objectContaining({ field: "registration" }));
  });

  describe("times", () => {
    const times = (...value: { date: string; start: string; end: string }[]) =>
      chooseRequestedChanges([{ field: "times", value }]);

    it("sorts the ranges by date then start", () => {
      expect(
        times(
          { date: "2026-12-02", start: "09:00", end: "10:00" },
          { date: "2026-12-01", start: "13:00", end: "14:00" },
          { date: "2026-12-01", start: "09:00", end: "12:00" },
        ),
      ).toEqual([
        {
          field: "times",
          value: [
            { date: "2026-12-01", start: "09:00", end: "12:00" },
            { date: "2026-12-01", start: "13:00", end: "14:00" },
            { date: "2026-12-02", start: "09:00", end: "10:00" },
          ],
        },
      ]);
    });

    it("accepts a range that runs to midnight and two that only touch", () => {
      expect(() =>
        times({ date: "2026-12-01", start: "09:00", end: "12:00" }, { date: "2026-12-01", start: "12:00", end: "24:00" }),
      ).not.toThrow();
    });

    it.each([
      ["no ranges", []],
      ["a date that is not real", [{ date: "2026-02-30", start: "09:00", end: "10:00" }]],
      ["a start off the grid", [{ date: "2026-12-01", start: "09:10", end: "10:00" }]],
      ["an end off the grid", [{ date: "2026-12-01", start: "09:00", end: "10:05" }]],
      ["an end equal to the start", [{ date: "2026-12-01", start: "09:00", end: "09:00" }]],
      ["an end before the start", [{ date: "2026-12-01", start: "10:00", end: "09:00" }]],
      ["a start at 24:00", [{ date: "2026-12-01", start: "24:00", end: "24:00" }]],
      [
        "two ranges that overlap on one date",
        [
          { date: "2026-12-01", start: "09:00", end: "12:00" },
          { date: "2026-12-01", start: "11:45", end: "13:00" },
        ],
      ],
    ])("refuses %s", (_label, value) => {
      expect(() => times(...value)).toThrow(expect.objectContaining({ field: "times" }));
    });
  });
});
