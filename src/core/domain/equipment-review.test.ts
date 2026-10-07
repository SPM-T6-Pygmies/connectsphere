import { describe, expect, it } from "vitest";

import type { CoordinatorEventStatus } from "./coordinator-event";
import { equipmentItemId } from "./equipment-item";
import type { EquipmentRequirement } from "./equipment-requirement";
import { attentionReason, equipmentQueueOf, isActiveEvent, reservedAs } from "./equipment-review";

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
