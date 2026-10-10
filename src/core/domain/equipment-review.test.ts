import { describe, expect, it } from "vitest";

import { clientOrganisationId } from "./client-organisation";
import type { CoordinatorEvent, CoordinatorEventStatus } from "./coordinator-event";
import { equipmentItemId } from "./equipment-item";
import { editEquipmentRequirement, type EquipmentRequirement } from "./equipment-requirement";
import {
  attentionReason,
  awaitsDecision,
  equipmentQueueOf,
  daysShortOfService,
  holdsOverlap,
  isActiveEvent,
  markEquipmentLineUnfulfilled,
  reserveEquipmentLine,
  reservedAs,
  unitsAvailable,
  unitsAvailableForLine,
  type EquipmentDecisionEvent,
  type EquipmentDecisionLine,
  type EquipmentHold,
  type EventReservation,
} from "./equipment-review";
import {
  EquipmentAvailableToReserveError,
  EquipmentLineNotAwaitingDecisionError,
  EventDateRequiredForEquipmentError,
  NotEnoughEquipmentAvailableError,
  UnfulfilledCommentRequiredError,
  UnfulfilledCommentTooLongError,
} from "./errors";
import { eventId } from "./event";
import { userAccountId } from "./user-account";

const ACTIVE: CoordinatorEventStatus[] = ["Planning", "Blocked", "Confirmed"];
const INACTIVE: CoordinatorEventStatus[] = ["Completed", "Cancelled"];

function line(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId("item-projector"),
    quantityRequested: 2,
    technicalRequirements: "HDMI input",
    quantityReserved: 2,
    state: "Reserved",
    reviewBaseline: null,
    removalRequested: false,
    decision: null,
    ...overrides,
  };
}

const newLine = () => line({ quantityReserved: 0, state: "Requested" });
const changedLine = () =>
  line({
    quantityRequested: 3,
    state: "Under review",
    reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
  });
const removalRequestedLine = () =>
  line({
    state: "Under review",
    reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
    removalRequested: true,
  });

describe("attentionReason (SPM-273)", () => {
  it("AC1: a line with nothing reserved against it is new", () => {
    expect(attentionReason(newLine())).toBe("new");
  });

  it("AC1: a reserved line the coordinator changed is changed", () => {
    expect(attentionReason(changedLine())).toBe("changed");
  });

  it("AC1: a reserved line the coordinator asked to remove is removal requested", () => {
    expect(attentionReason(removalRequestedLine())).toBe("removalRequested");
  });

  it("AC1: a reserved line nobody has touched since needs no attention", () => {
    expect(attentionReason(line())).toBeNull();
  });
});

describe("reservedAs (SPM-273)", () => {
  it("AC3: a changed line shows the quantity and notes it had when it was reserved", () => {
    expect(reservedAs(changedLine())).toEqual({ quantityRequested: 2, technicalRequirements: "HDMI input" });
  });

  it("AC3: a line whose notes alone changed shows what they were", () => {
    const changed = line({
      technicalRequirements: "HDMI and VGA",
      state: "Under review",
      reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
    });

    expect(reservedAs(changed)).toEqual({ quantityRequested: 2, technicalRequirements: "HDMI input" });
  });

  it("AC3: a removal request on an unchanged line has nothing to show", () => {
    expect(reservedAs(removalRequestedLine())).toBeNull();
  });

  it("AC3: a new or reserved line has nothing to show", () => {
    expect(reservedAs(newLine())).toBeNull();
    expect(reservedAs(line())).toBeNull();
  });
});

describe("isActiveEvent (SPM-273)", () => {
  it.each(ACTIVE)("AC1: a %s event is active", (status) => {
    expect(isActiveEvent(status)).toBe(true);
  });

  it.each(INACTIVE)("AC1: a %s event is not active", (status) => {
    expect(isActiveEvent(status)).toBe(false);
  });
});

describe("equipmentQueueOf (SPM-273)", () => {
  it.each(ACTIVE)("AC1: a %s event with a new line needs review", (status) => {
    expect(equipmentQueueOf(status, [line(), newLine()])).toBe("needsReview");
  });

  it("AC1: an active event with a changed or removal-requested line needs review", () => {
    expect(equipmentQueueOf("Planning", [changedLine()])).toBe("needsReview");
    expect(equipmentQueueOf("Confirmed", [removalRequestedLine()])).toBe("needsReview");
  });

  it.each(INACTIVE)("AC1: a %s event is archived, even with lines needing attention", (status) => {
    expect(equipmentQueueOf(status, [newLine(), changedLine()])).toBe("archive");
  });
});

describe("holdsOverlap (SPM-273)", () => {
  it.each([
    ["2026-11-13", false],
    ["2026-11-14", true],
    ["2026-11-15", true],
    ["2026-11-16", true],
    ["2026-11-17", false],
  ])("AC4: an event on 15 Nov and one on %s share days: %s", (other, overlaps) => {
    expect(holdsOverlap("2026-11-15", other)).toBe(overlaps);
  });

  it("AC4: counts days across a month and a year end", () => {
    expect(holdsOverlap("2026-11-30", "2026-12-01")).toBe(true);
    expect(holdsOverlap("2026-12-31", "2027-01-01")).toBe(true);
    expect(holdsOverlap("2026-12-31", "2027-01-02")).toBe(false);
  });
});

describe("unitsAvailable (SPM-273)", () => {
  function hold(overrides: Partial<EquipmentHold> = {}): EquipmentHold {
    return { eventStatus: "Planning", eventDate: "2026-11-15", quantityReserved: 1, ...overrides };
  }

  it("AC4: subtracts what events the day before, the same day and the day after hold, and nothing further out", () => {
    const holds = [
      hold({ eventDate: "2026-11-13", quantityReserved: 7 }),
      hold({ eventDate: "2026-11-14", quantityReserved: 3 }),
      hold({ eventDate: "2026-11-15", quantityReserved: 2 }),
      hold({ eventDate: "2026-11-16", quantityReserved: 1 }),
      hold({ eventDate: "2026-11-17", quantityReserved: 5 }),
    ];

    expect(unitsAvailable(10, 0, "2026-11-15", holds)).toBe(4);
  });

  it("AC4: everything owned is available when no other event holds any", () => {
    expect(unitsAvailable(10, 0, "2026-11-15", [])).toBe(10);
  });

  it.each(ACTIVE)("AC4: a %s event's hold counts", (status) => {
    expect(unitsAvailable(10, 0, "2026-11-15", [hold({ eventStatus: status, quantityReserved: 4 })])).toBe(6);
  });

  it.each(INACTIVE)("AC4: a %s event's hold does not count", (status) => {
    expect(unitsAvailable(10, 0, "2026-11-15", [hold({ eventStatus: status, quantityReserved: 4 })])).toBe(10);
  });

  it("AC4: an undated event's hold does not count", () => {
    expect(unitsAvailable(10, 0, "2026-11-15", [hold({ eventDate: null, quantityReserved: 4 })])).toBe(10);
  });

  it("AC4: gives no number for an event with no date yet", () => {
    expect(unitsAvailable(10, 0, null, [hold()])).toBeNull();
  });
});

describe("unitsAvailableForLine (SPM-273)", () => {
  const holds: EquipmentHold[] = [{ eventStatus: "Planning", eventDate: "2026-11-14", quantityReserved: 3 }];

  it("AC4: takes what the line already holds off what is free for the event", () => {
    expect(unitsAvailableForLine(line({ quantityReserved: 2 }), 10, 0, "2026-11-15", holds)).toBe(5);
  });

  it("AC4: a changed line counts what it still holds, not its new quantity", () => {
    expect(unitsAvailableForLine(changedLine(), 10, 0, "2026-11-15", holds)).toBe(5);
  });

  it("AC4: a line with nothing reserved shows everything free for the event", () => {
    expect(unitsAvailableForLine(newLine(), 10, 0, "2026-11-15", holds)).toBe(7);
  });

  it("AC4: gives no number for an event with no date yet", () => {
    expect(unitsAvailableForLine(line({ quantityReserved: 2 }), 10, 0, null, holds)).toBeNull();
  });
});

describe("unitsAvailable (SPM-17)", () => {
  const hold: EquipmentHold = { eventStatus: "Planning", eventDate: "2026-11-15", quantityReserved: 3 };

  it("AC4: takes the units out of service off the units owned", () => {
    expect(unitsAvailable(10, 2, "2026-11-15", [hold])).toBe(5);
  });

  it("AC4: with no units out of service, every unit owned counts", () => {
    expect(unitsAvailable(10, 0, "2026-11-15", [hold])).toBe(7);
  });

  it("AC4: with every unit out of service, none is available", () => {
    expect(unitsAvailable(10, 10, "2026-11-15", [])).toBe(0);
  });
});

const SUPPORT = userAccountId("support-1");
const dated: EquipmentDecisionEvent = { status: "Planning", preferredDate: "2026-11-15" };
const undated: EquipmentDecisionEvent = { status: "Planning", preferredDate: null };

/** A New line for 5, with 10 owned and `held` reserved by an event the day before. */
function target(held: number, overrides: Partial<EquipmentRequirement> = {}): EquipmentDecisionLine {
  return {
    line: line({ quantityRequested: 5, quantityReserved: 0, state: "Requested", ...overrides }),
    owned: 10,
    outOfService: 0,
    otherHolds: [{ eventStatus: "Confirmed", eventDate: "2026-11-14", quantityReserved: held }],
  };
}

const unfulfilled = () =>
  target(7, { state: "Unfulfilled", decision: { by: userAccountId("support-2"), comment: "only 3 available" } });

/** A line marked unfulfilled at 5, which the coordinator then cut to 3. */
function changedAfterUnfulfilled(held: number): EquipmentDecisionLine {
  const coordinatorEvent: CoordinatorEvent = {
    id: eventId("event-1"),
    name: "Founders' Gala Dinner",
    description: null,
    status: "Planning",
    preferredDate: "2026-11-15",
    expectedAttendance: null,
    statedEquipmentNeeds: null,
    clientOrganisationId: clientOrganisationId("org-1"),
    owningOrganiserUserAccountId: userAccountId("organiser-1"),
    assignedCoordinatorUserAccountId: userAccountId("coordinator-1"),
  };
  const edited = editEquipmentRequirement(coordinatorEvent, unfulfilled().line, {
    quantityRequested: 3,
    technicalRequirements: "HDMI input",
  });
  return { ...target(held), line: edited.line };
}

describe("awaitsDecision (SPM-274)", () => {
  it("AC1: a New line on an active event awaits a decision", () => {
    expect(awaitsDecision("Planning", newLine())).toBe(true);
  });

  it("AC1: a reserved line, or one on a Completed or Cancelled event, does not", () => {
    expect(awaitsDecision("Planning", line())).toBe(false);
    expect(awaitsDecision("Completed", newLine())).toBe(false);
    expect(awaitsDecision("Cancelled", newLine())).toBe(false);
  });

  it("AC4: a line marked unfulfilled awaits one again once the coordinator changes it", () => {
    expect(awaitsDecision("Planning", unfulfilled().line)).toBe(false);
    expect(awaitsDecision("Planning", changedAfterUnfulfilled(0).line)).toBe(true);
  });

  it("AC4: a changed or removal-requested line with units reserved does not", () => {
    expect(awaitsDecision("Planning", changedLine())).toBe(false);
    expect(awaitsDecision("Planning", removalRequestedLine())).toBe(false);
  });
});

describe("reserveEquipmentLine (SPM-274)", () => {
  it("AC1: reserves the full quantity requested and records who reserved it", () => {
    const reserved = reserveEquipmentLine(dated, target(0), SUPPORT);

    expect(reserved).toMatchObject({ quantityReserved: 5, state: "Reserved", reviewBaseline: null });
    expect(reserved.decision).toEqual({ by: SUPPORT, comment: null });
  });

  it("AC1: a reserved line no longer needs attention", () => {
    expect(attentionReason(reserveEquipmentLine(dated, target(0), SUPPORT))).toBeNull();
  });

  it("AC1: reserves when exactly the quantity requested is available", () => {
    expect(reserveEquipmentLine(dated, target(5), SUPPORT).quantityReserved).toBe(5);
  });

  it("AC3: reserves nothing when one fewer than requested is available", () => {
    expect(() => reserveEquipmentLine(dated, target(6), SUPPORT)).toThrow(NotEnoughEquipmentAvailableError);
  });

  it("AC3: reserves nothing when units out of service leave too few", () => {
    expect(() => reserveEquipmentLine(dated, { ...target(0), outOfService: 6 }, SUPPORT)).toThrow(
      NotEnoughEquipmentAvailableError,
    );
  });

  it("AC2: refuses while the event has no date", () => {
    expect(() => reserveEquipmentLine(undated, target(0), SUPPORT)).toThrow(EventDateRequiredForEquipmentError);
  });

  it("AC1: refuses a line that does not await a decision", () => {
    expect(() => reserveEquipmentLine(dated, { ...target(0), line: line() }, SUPPORT)).toThrow(
      EquipmentLineNotAwaitingDecisionError,
    );
    expect(() => reserveEquipmentLine(dated, unfulfilled(), SUPPORT)).toThrow(EquipmentLineNotAwaitingDecisionError);
  });

  it("AC4: reserves a changed line that was marked unfulfilled, clearing what it was", () => {
    const reserved = reserveEquipmentLine(dated, changedAfterUnfulfilled(7), SUPPORT);

    expect(reserved).toMatchObject({ quantityReserved: 3, state: "Reserved", reviewBaseline: null });
    expect(reserved.decision).toEqual({ by: SUPPORT, comment: null });
  });
});

describe("markEquipmentLineUnfulfilled (SPM-274)", () => {
  it("AC3: marks the line unfulfilled with the comment and who marked it, reserving nothing", () => {
    const marked = markEquipmentLineUnfulfilled(dated, target(7), SUPPORT, "  only 3 available ");

    expect(marked).toMatchObject({ state: "Unfulfilled", quantityReserved: 0, reviewBaseline: null });
    expect(marked.decision).toEqual({ by: SUPPORT, comment: "only 3 available" });
  });

  it("AC3: an unfulfilled line no longer needs attention", () => {
    expect(attentionReason(markEquipmentLineUnfulfilled(dated, target(7), SUPPORT, "only 3 available"))).toBeNull();
  });

  it("AC3: marks it when one fewer than requested is available", () => {
    expect(markEquipmentLineUnfulfilled(dated, target(6), SUPPORT, "only 4 available").state).toBe("Unfulfilled");
  });

  it("AC3: refuses while exactly the quantity requested is available", () => {
    expect(() => markEquipmentLineUnfulfilled(dated, target(5), SUPPORT, "none spare")).toThrow(
      EquipmentAvailableToReserveError,
    );
  });

  it("AC3: refuses a blank comment", () => {
    expect(() => markEquipmentLineUnfulfilled(dated, target(7), SUPPORT, "   ")).toThrow(UnfulfilledCommentRequiredError);
  });

  it("AC3: accepts a comment of exactly 500 characters and refuses 501", () => {
    expect(markEquipmentLineUnfulfilled(dated, target(7), SUPPORT, "x".repeat(500)).decision?.comment).toHaveLength(500);
    expect(() => markEquipmentLineUnfulfilled(dated, target(7), SUPPORT, "x".repeat(501))).toThrow(
      UnfulfilledCommentTooLongError,
    );
  });

  it("AC2: refuses while the event has no date", () => {
    expect(() => markEquipmentLineUnfulfilled(undated, target(7), SUPPORT, "only 3 available")).toThrow(
      EventDateRequiredForEquipmentError,
    );
  });

  it("AC4: marks a changed line that was marked unfulfilled again, with the new comment", () => {
    const marked = markEquipmentLineUnfulfilled(dated, changedAfterUnfulfilled(9), SUPPORT, "only 1 available");

    expect(marked).toMatchObject({ state: "Unfulfilled", quantityRequested: 3, reviewBaseline: null });
    expect(marked.decision).toEqual({ by: SUPPORT, comment: "only 1 available" });
  });
});

describe("attentionReason (SPM-274)", () => {
  it("AC4: a line marked unfulfilled and then changed by the coordinator is changed", () => {
    expect(attentionReason(changedAfterUnfulfilled(0).line)).toBe("changed");
  });

  it("AC4: a changed unfulfilled line shows what it was when marked unfulfilled", () => {
    expect(reservedAs(changedAfterUnfulfilled(0).line)).toEqual({ quantityRequested: 5, technicalRequirements: "HDMI input" });
  });
});

describe("daysShortOfService (SPM-274)", () => {
  const TODAY = "2026-11-10";

  function reservation(
    eventId: string,
    eventDate: string | null,
    quantityReserved: number,
    overrides: Partial<EventReservation> = {},
  ): EventReservation {
    return { eventId, eventName: `Event ${eventId}`, eventStatus: "Planning", eventDate, quantityReserved, ...overrides };
  }

  const event = (eventId: string, eventDate: string, quantityReserved: number) => ({
    eventId,
    eventName: `Event ${eventId}`,
    eventDate,
    quantityReserved,
  });

  it("AC7: a day is short when the events whose units are out that day hold more than is in service", () => {
    const reservations = [reservation("A", "2026-11-20", 6), reservation("B", "2026-11-21", 2)];

    expect(daysShortOfService(7, reservations, TODAY)).toEqual([
      { from: "2026-11-20", to: "2026-11-20", reserved: 8, events: [event("A", "2026-11-20", 6), event("B", "2026-11-21", 2)] },
    ]);
  });

  it("AC7: an event's units are out only on the day before it and on its date", () => {
    const reservations = [
      reservation("A", "2026-11-14", 3),
      reservation("B", "2026-11-15", 2),
      reservation("C", "2026-11-16", 1),
      reservation("D", "2026-11-17", 5),
    ];

    expect(daysShortOfService(4, reservations, TODAY).map((run) => [run.from, run.to, run.reserved])).toEqual([
      ["2026-11-14", "2026-11-14", 5],
      ["2026-11-16", "2026-11-16", 6],
      ["2026-11-17", "2026-11-17", 5],
    ]);
  });

  it("AC7: merges back-to-back days with the same events into one run", () => {
    expect(daysShortOfService(5, [reservation("A", "2026-11-20", 6)], TODAY)).toEqual([
      { from: "2026-11-19", to: "2026-11-20", reserved: 6, events: [event("A", "2026-11-20", 6)] },
    ]);
  });

  it("AC7: keeps back-to-back days apart when different events are out", () => {
    const reservations = [reservation("A", "2026-11-20", 6), reservation("B", "2026-11-21", 2)];

    expect(daysShortOfService(5, reservations, TODAY).map((run) => [run.from, run.to, run.reserved])).toEqual([
      ["2026-11-19", "2026-11-19", 6],
      ["2026-11-20", "2026-11-20", 8],
    ]);
  });

  it("AC7: exactly what is in service is not short; one more is", () => {
    expect(daysShortOfService(5, [reservation("A", "2026-11-20", 5)], TODAY)).toEqual([]);
    expect(daysShortOfService(4, [reservation("A", "2026-11-20", 5)], TODAY)).toHaveLength(1);
  });

  it("AC7: counts days from today on, including today", () => {
    expect(daysShortOfService(0, [reservation("A", "2026-11-11", 1)], TODAY)).toEqual([
      { from: "2026-11-10", to: "2026-11-11", reserved: 1, events: [event("A", "2026-11-11", 1)] },
    ]);
    expect(daysShortOfService(0, [reservation("A", "2026-11-09", 1)], TODAY)).toEqual([]);
  });

  it("AC7: leaves out undated events, and Completed or Cancelled events' reservations", () => {
    const reservations = [
      reservation("undated", null, 9),
      reservation("cancelled", "2026-11-15", 9, { eventStatus: "Cancelled" }),
      reservation("completed", "2026-11-15", 9, { eventStatus: "Completed" }),
    ];

    expect(daysShortOfService(3, reservations, TODAY)).toEqual([]);
  });
});
