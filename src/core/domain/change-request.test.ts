import { describe, expect, it } from "vitest";

import {
  assertCanDecideChangeRequest,
  assertCanSubmitChangeRequest,
  changeRequestId,
  changeRequestStateFor,
  changeRequestStatus,
  chooseRequestedChanges,
  decideChangeRequest,
  type ChangeRequest,
  type ChangeRequestTarget,
  type ItemDecision,
  type RequestedChange,
} from "./change-request";
import type { CoordinatorEventStatus } from "./coordinator-event";
import {
  ChangeRequestAlreadyDecidedError,
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  ChangeRequestNotFoundError,
  EventRequestNotFoundError,
  InvalidChangeRequestDecisionError,
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
    eventName: "Marina Bay Gala",
    assignedCoordinatorUserAccountId: null,
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

function pending(...changes: RequestedChange[]): ChangeRequest {
  return {
    id: changeRequestId("4"),
    submittedAt: new Date("2026-10-27T02:00:00Z"),
    requestedBy: userAccountId("organiser-1"),
    items: changes.map((change) => ({ change, decision: "Pending", reason: null })),
  };
}

const accept = (field: ItemDecision["field"]): ItemDecision => ({ field, outcome: "Accepted" });
const decline = (field: ItemDecision["field"], reason = "Room caps at 300"): ItemDecision => ({
  field,
  outcome: "Declined",
  reason,
});

const nowTimes = [{ date: "2026-12-01", start: "09:00", end: "12:00" }];
const [timesChange, venueChange, attendanceChange, equipmentChange, registrationChange] = allFive;

describe("changeRequestStatus (SPM-100)", () => {
  it("is Pending while any item is Pending", () => {
    const request = pending(timesChange, venueChange);
    expect(changeRequestStatus(request)).toBe("Pending");
    expect(
      changeRequestStatus({ ...request, items: [{ change: request.items[0].change, decision: "Accepted", reason: null }, request.items[1]] }),
    ).toBe("Pending");
  });

  it("is Decided once every item is", () => {
    const decided = decideChangeRequest(pending(timesChange), [accept("times")], nowTimes);
    expect(changeRequestStatus({ ...pending(timesChange), items: decided.items })).toBe("Decided");
  });
});

describe("assertCanDecideChangeRequest (SPM-100)", () => {
  it.each(["Planning", "Blocked", "Confirmed"] as const)("lets the assigned Coordinator decide on a %s event", (status) => {
    expect(() => assertCanDecideChangeRequest({ status }, pending(timesChange), "4")).not.toThrow();
  });

  it("refuses an event not assigned to the caller as not found (#91)", () => {
    expect(() => assertCanDecideChangeRequest(null, pending(timesChange), "4")).toThrow(ChangeRequestNotFoundError);
  });

  it("refuses a request the event does not have as not found", () => {
    expect(() => assertCanDecideChangeRequest({ status: "Planning" }, null, "4")).toThrow(ChangeRequestNotFoundError);
  });

  it.each(["Completed", "Cancelled"] as const)("refuses a %s event", (status) => {
    expect(() => assertCanDecideChangeRequest({ status }, pending(timesChange), "4")).toThrow(ChangeRequestClosedError);
  });
});

describe("decideChangeRequest (SPM-100)", () => {
  it("AC2: accepts every field", () => {
    const decision = decideChangeRequest(
      pending(...allFive),
      allFive.map((change) => accept(change.field)),
      nowTimes,
    );

    expect(decision.items.every((item) => item.decision === "Accepted" && item.reason === null)).toBe(true);
    expect(decision.rescheduled).toBe(true);
  });

  it("AC2, AC4: declines every field, which revalidates nothing", () => {
    const decision = decideChangeRequest(
      pending(...allFive),
      allFive.map((change) => decline(change.field)),
      nowTimes,
    );

    expect(decision.items.map((item) => item.decision)).toEqual(Array(5).fill("Declined"));
    expect(decision).toMatchObject({
      notEssential: [],
      revalidation: { bookingFlagFields: [], equipmentReview: false },
      rescheduled: false,
    });
  });

  it("AC2, AC3: accepts some and declines others in one pass, keeping each reason trimmed", () => {
    const decision = decideChangeRequest(
      pending(timesChange, attendanceChange),
      [accept("times"), decline("expected_attendance", "  Room caps at 300  ")],
      nowTimes,
    );

    expect(decision.items).toEqual([
      { change: timesChange, decision: "Accepted", reason: null },
      { change: attendanceChange, decision: "Declined", reason: "Room caps at 300" },
    ]);
  });

  it.each(["", "   "])("AC3: refuses a decline whose reason is %j", (reason) => {
    expect(() =>
      decideChangeRequest(pending(timesChange), [{ field: "times", outcome: "Declined", reason }], nowTimes),
    ).toThrow(expect.objectContaining({ field: "times", constructor: InvalidChangeRequestDecisionError }));
  });

  it("refuses to leave an item undecided", () => {
    expect(() => decideChangeRequest(pending(timesChange, venueChange), [accept("times")], nowTimes)).toThrow(
      expect.objectContaining({ field: "venue_requirements", constructor: InvalidChangeRequestDecisionError }),
    );
  });

  it("refuses a decision on a field the request does not ask for", () => {
    expect(() =>
      decideChangeRequest(pending(timesChange), [accept("times"), accept("expected_attendance")], nowTimes),
    ).toThrow(expect.objectContaining({ field: "expected_attendance", constructor: InvalidChangeRequestDecisionError }));
  });

  it("refuses two decisions on one field", () => {
    expect(() => decideChangeRequest(pending(timesChange), [accept("times"), decline("times")], nowTimes)).toThrow(
      InvalidChangeRequestDecisionError,
    );
  });

  it("refuses a request that is already decided", () => {
    const request = pending(timesChange);
    const decided = { ...request, items: decideChangeRequest(request, [accept("times")], nowTimes).items };

    expect(() => decideChangeRequest(decided, [accept("times")], nowTimes)).toThrow(ChangeRequestAlreadyDecidedError);
  });

  describe("AC5: what an accepted field revalidates", () => {
    it.each([
      ["times", timesChange],
      ["expected_attendance", attendanceChange],
      ["venue_requirements", venueChange],
    ] as const)("accepting %s flags the venue bookings", (field, change) => {
      const decision = decideChangeRequest(pending(change), [accept(field)], nowTimes);
      expect(decision.revalidation.bookingFlagFields).toEqual([field]);
    });

    it("accepting only a revised equipment need flags no booking and reviews no equipment", () => {
      const decision = decideChangeRequest(pending(equipmentChange), [accept("equipment_requirements")], nowTimes);
      expect(decision.revalidation).toEqual({ bookingFlagFields: [], equipmentReview: false });
    });

    it("a declined field flags nothing", () => {
      const decision = decideChangeRequest(
        pending(attendanceChange, venueChange),
        [accept("expected_attendance"), decline("venue_requirements")],
        nowTimes,
      );
      expect(decision.revalidation.bookingFlagFields).toEqual(["expected_attendance"]);
    });

    it("a new time on the same date puts no equipment under review", () => {
      const sameDate: RequestedChange = { field: "times", value: [{ date: "2026-12-01", start: "14:00", end: "18:00" }] };
      const decision = decideChangeRequest(pending(sameDate), [accept("times")], nowTimes);
      expect(decision.revalidation.equipmentReview).toBe(false);
      expect(decision.rescheduled).toBe(true);
    });

    it("a new date puts the equipment under review", () => {
      const newDate: RequestedChange = { field: "times", value: [{ date: "2026-12-02", start: "09:00", end: "12:00" }] };
      expect(decideChangeRequest(pending(newDate), [accept("times")], nowTimes).revalidation.equipmentReview).toBe(true);
    });

    it("an added date puts the equipment under review", () => {
      const addedDate: RequestedChange = {
        field: "times",
        value: [...nowTimes, { date: "2026-12-02", start: "09:00", end: "12:00" }],
      };
      expect(decideChangeRequest(pending(addedDate), [accept("times")], nowTimes).revalidation.equipmentReview).toBe(
        true,
      );
    });

    it("an accepted Not applicable marks the arrangement not essential and revalidates nothing", () => {
      const decision = decideChangeRequest(
        pending(
          { field: "equipment_requirements", value: null },
          { field: "registration", value: null },
        ),
        [accept("equipment_requirements"), accept("registration")],
        nowTimes,
      );

      expect(decision).toMatchObject({
        notEssential: ["equipment", "registration"],
        revalidation: { bookingFlagFields: [], equipmentReview: false },
        rescheduled: false,
      });
    });

    it("accepted registration settings keep registration essential", () => {
      const decision = decideChangeRequest(pending(registrationChange), [accept("registration")], nowTimes);
      expect(decision.notEssential).toEqual([]);
    });

    it("a declined Not applicable changes nothing", () => {
      const decision = decideChangeRequest(
        pending({ field: "registration", value: null }),
        [decline("registration")],
        nowTimes,
      );
      expect(decision.notEssential).toEqual([]);
    });
  });
});
