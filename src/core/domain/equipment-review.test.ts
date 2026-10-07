import { describe, expect, it } from "vitest";

import type { CoordinatorEventStatus } from "./coordinator-event";
import { equipmentItemId } from "./equipment-item";
import type { EquipmentRequirement } from "./equipment-requirement";
import {
  attentionReason,
  equipmentQueueOf,
  holdsOverlap,
  isActiveEvent,
  reservedAs,
  unitsAvailable,
  type EquipmentHold,
} from "./equipment-review";

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

  it("an active event whose lines are all reserved and untouched is reviewed", () => {
    expect(equipmentQueueOf("Blocked", [line(), line({ equipmentItemId: equipmentItemId("item-mic") })])).toBe(
      "reviewed",
    );
  });

  it.each(INACTIVE)("AC1: a %s event is archived, even with lines needing attention", (status) => {
    expect(equipmentQueueOf(status, [newLine(), changedLine()])).toBe("archive");
  });

  it("an event with no equipment lines is on no list", () => {
    expect(equipmentQueueOf("Planning", [])).toBeNull();
    expect(equipmentQueueOf("Completed", [])).toBeNull();
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

    expect(unitsAvailable(10, "2026-11-15", holds)).toBe(4);
  });

  it("AC4: everything owned is available when no other event holds any", () => {
    expect(unitsAvailable(10, "2026-11-15", [])).toBe(10);
  });

  it.each(ACTIVE)("AC4: a %s event's hold counts", (status) => {
    expect(unitsAvailable(10, "2026-11-15", [hold({ eventStatus: status, quantityReserved: 4 })])).toBe(6);
  });

  it.each(INACTIVE)("AC4: a %s event's hold does not count", (status) => {
    expect(unitsAvailable(10, "2026-11-15", [hold({ eventStatus: status, quantityReserved: 4 })])).toBe(10);
  });

  it("AC4: an undated event's hold does not count", () => {
    expect(unitsAvailable(10, "2026-11-15", [hold({ eventDate: null, quantityReserved: 4 })])).toBe(10);
  });

  it("AC4: gives no number for an event with no date yet", () => {
    expect(unitsAvailable(10, null, [hold()])).toBeNull();
  });
});
