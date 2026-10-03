import { describe, expect, it } from "vitest";

import { clientOrganisationId } from "./client-organisation";
import type {
  CoordinatorEvent,
  CoordinatorEventStatus,
} from "./coordinator-event";
import { equipmentItemId } from "./equipment-item";
import {
  editEquipmentRequirement,
  equipmentRequirementsEditable,
  recheckReason,
  recordEquipmentRequirement,
  removeEquipmentRequirement,
  undoEquipmentRemoval,
  type EquipmentRequirement,
  type NewEquipmentRequirement,
} from "./equipment-requirement";
import {
  DuplicateEquipmentRequirementError,
  EquipmentRemovalAlreadyRequestedError,
  EquipmentRemovalNotRequestedError,
  EquipmentRequirementsLockedError,
  InvalidEquipmentItemIdError,
  InvalidEquipmentQuantityError,
  TechnicalRequirementsTooLongError,
} from "./errors";
import { eventId } from "./event";
import { userAccountId } from "./user-account";

const PROJECTOR = equipmentItemId("item-projector");
const MICROPHONE = equipmentItemId("item-microphone");

const EDITABLE: CoordinatorEventStatus[] = ["Planning", "Blocked", "Confirmed"];
const LOCKED: CoordinatorEventStatus[] = ["Completed", "Cancelled"];

function event(overrides: Partial<CoordinatorEvent> = {}): CoordinatorEvent {
  return {
    id: eventId("event-1"),
    name: "Founders' Day",
    description: null,
    status: "Planning",
    preferredDate: null,
    expectedAttendance: null,
    statedEquipmentNeeds: null,
    clientOrganisationId: clientOrganisationId("org-1"),
    owningOrganiserUserAccountId: userAccountId("organiser-1"),
    assignedCoordinatorUserAccountId: userAccountId("coordinator-1"),
    ...overrides,
  };
}

function newRequirement(
  overrides: Partial<NewEquipmentRequirement> = {},
): NewEquipmentRequirement {
  return {
    equipmentItemId: PROJECTOR,
    quantityRequested: 2,
    technicalRequirements: null,
    ...overrides,
  };
}

function line(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  const built: EquipmentRequirement = {
    equipmentItemId: PROJECTOR,
    quantityRequested: 2,
    technicalRequirements: "HDMI input",
    quantityReserved: 0,
    state: "Requested",
    reviewBaseline: null,
    removalRequested: false,
    ...overrides,
  };
  // A line under review always remembers what it was reviewed as; default to its own values.
  return built.state === "Under review" && overrides.reviewBaseline === undefined
    ? {
        ...built,
        reviewBaseline: { quantityRequested: built.quantityRequested, technicalRequirements: built.technicalRequirements },
      }
    : built;
}

const reserved = (overrides: Partial<EquipmentRequirement> = {}) =>
  line({ quantityReserved: 2, state: "Reserved", ...overrides });

describe("equipmentItemId (SPM-182)", () => {
  it("rejects a blank equipment type", () => {
    expect(() => equipmentItemId("  ")).toThrow(InvalidEquipmentItemIdError);
  });
});

describe("equipmentRequirementsEditable (SPM-182)", () => {
  it.each(EDITABLE)("is true for a %s event", (status) => {
    expect(equipmentRequirementsEditable(status)).toBe(true);
  });

  it.each(LOCKED)("is false for a %s event", (status) => {
    expect(equipmentRequirementsEditable(status)).toBe(false);
  });
});

describe("recordEquipmentRequirement (SPM-182)", () => {
  it("records a new line with nothing reserved and not under review", () => {
    expect(
      recordEquipmentRequirement(
        event(),
        [],
        newRequirement({ technicalRequirements: "HDMI input" }),
      ),
    ).toEqual({
      equipmentItemId: PROJECTOR,
      quantityRequested: 2,
      technicalRequirements: "HDMI input",
      quantityReserved: 0,
      state: "Requested",
      reviewBaseline: null,
      removalRequested: false,
    });
  });

  it("accepts a line without technical requirements", () => {
    expect(
      recordEquipmentRequirement(event(), [], newRequirement()).technicalRequirements,
    ).toBeNull();
  });

  it("stores blank technical requirements as none", () => {
    expect(
      recordEquipmentRequirement(
        event(),
        [],
        newRequirement({ technicalRequirements: "   " }),
      ).technicalRequirements,
    ).toBeNull();
  });

  it("adds a line for a type the event does not have yet", () => {
    expect(
      recordEquipmentRequirement(
        event(),
        [line({ equipmentItemId: MICROPHONE })],
        newRequirement(),
      ).equipmentItemId,
    ).toBe(PROJECTOR);
  });

  it("refuses a second line for a type the event already has", () => {
    expect(() =>
      recordEquipmentRequirement(event(), [line()], newRequirement()),
    ).toThrow(DuplicateEquipmentRequirementError);
  });

  it("refuses a second line for a type whose removal is still pending", () => {
    expect(() =>
      recordEquipmentRequirement(
        event(),
        [reserved({ removalRequested: true, state: "Under review" })],
        newRequirement(),
      ),
    ).toThrow(DuplicateEquipmentRequirementError);
  });

  it("rejects a quantity of 0", () => {
    expect(() =>
      recordEquipmentRequirement(event(), [], newRequirement({ quantityRequested: 0 })),
    ).toThrow(InvalidEquipmentQuantityError);
  });

  it("accepts a quantity of 1", () => {
    expect(
      recordEquipmentRequirement(event(), [], newRequirement({ quantityRequested: 1 }))
        .quantityRequested,
    ).toBe(1);
  });

  it("accepts a quantity of 2", () => {
    expect(
      recordEquipmentRequirement(event(), [], newRequirement({ quantityRequested: 2 }))
        .quantityRequested,
    ).toBe(2);
  });

  it("rejects a quantity that is not a whole number", () => {
    expect(() =>
      recordEquipmentRequirement(event(), [], newRequirement({ quantityRequested: 1.5 })),
    ).toThrow(InvalidEquipmentQuantityError);
  });

  it("accepts technical requirements of exactly 500 characters", () => {
    const notes = "x".repeat(500);
    expect(
      recordEquipmentRequirement(
        event(),
        [],
        newRequirement({ technicalRequirements: notes }),
      ).technicalRequirements,
    ).toBe(notes);
  });

  it("rejects technical requirements of 501 characters", () => {
    expect(() =>
      recordEquipmentRequirement(
        event(),
        [],
        newRequirement({ technicalRequirements: "x".repeat(501) }),
      ),
    ).toThrow(TechnicalRequirementsTooLongError);
  });

  it.each(EDITABLE)("records a line on a %s event", (status) => {
    expect(
      recordEquipmentRequirement(event({ status }), [], newRequirement()).quantityRequested,
    ).toBe(2);
  });

  it.each(LOCKED)("refuses to record a line on a %s event", (status) => {
    expect(() =>
      recordEquipmentRequirement(event({ status }), [], newRequirement()),
    ).toThrow(EquipmentRequirementsLockedError);
  });
});

describe("editEquipmentRequirement (SPM-182)", () => {
  it("saves a change to an unreserved line without putting it under review", () => {
    expect(
      editEquipmentRequirement(event(), line(), {
        quantityRequested: 3,
        technicalRequirements: "HDMI input",
      }),
    ).toEqual({
      line: line({ quantityRequested: 3 }),
      changed: true,
      underReview: false,
      reviewCleared: false,
    });
  });

  it("saves a quantity change to a reserved line, puts it under review and keeps its equipment held", () => {
    expect(
      editEquipmentRequirement(event(), reserved(), {
        quantityRequested: 4,
        technicalRequirements: "HDMI input",
      }),
    ).toEqual({
      line: reserved({
        quantityRequested: 4,
        state: "Under review",
        reviewBaseline: { quantityRequested: 2, technicalRequirements: "HDMI input" },
      }),
      changed: true,
      underReview: true,
      reviewCleared: false,
    });
  });

  it("puts a reserved line under review when its technical requirements alone change", () => {
    const edit = editEquipmentRequirement(event(), reserved(), {
      quantityRequested: 2,
      technicalRequirements: "HDMI and USB-C input",
    });
    expect(edit.underReview).toBe(true);
    expect(edit.line.technicalRequirements).toBe("HDMI and USB-C input");
    expect(edit.line.state).toBe("Under review");
  });

  it("keeps a reserved line's equipment held when the quantity drops below what was reserved", () => {
    const edit = editEquipmentRequirement(event(), reserved({ quantityReserved: 2 }), {
      quantityRequested: 1,
      technicalRequirements: "HDMI input",
    });
    expect(edit.line.quantityRequested).toBe(1);
    expect(edit.line.quantityReserved).toBe(2);
    expect(edit.underReview).toBe(true);
  });

  it("leaves a reserved line as it was when the save changes nothing", () => {
    const original = reserved();
    expect(
      editEquipmentRequirement(event(), original, {
        quantityRequested: 2,
        technicalRequirements: "HDMI input",
      }),
    ).toEqual({ line: original, changed: false, underReview: false, reviewCleared: false });
  });

  it("treats blank technical requirements as unchanged from none", () => {
    expect(
      editEquipmentRequirement(event(), reserved({ technicalRequirements: null }), {
        quantityRequested: 2,
        technicalRequirements: "  ",
      }).changed,
    ).toBe(false);
  });

  it("keeps a line under review when it is edited again", () => {
    const edit = editEquipmentRequirement(event(), reserved({ state: "Under review" }), {
      quantityRequested: 3,
      technicalRequirements: "HDMI input",
    });
    expect(edit.underReview).toBe(true);
    expect(edit.line.state).toBe("Under review");
  });

  it("rejects an edit to a quantity of 0", () => {
    expect(() =>
      editEquipmentRequirement(event(), line(), {
        quantityRequested: 0,
        technicalRequirements: null,
      }),
    ).toThrow(InvalidEquipmentQuantityError);
  });

  it("rejects an edit to technical requirements of 501 characters", () => {
    expect(() =>
      editEquipmentRequirement(event(), line(), {
        quantityRequested: 2,
        technicalRequirements: "x".repeat(501),
      }),
    ).toThrow(TechnicalRequirementsTooLongError);
  });

  it("refuses to edit a line whose removal is already requested", () => {
    expect(() =>
      editEquipmentRequirement(
        event(),
        reserved({ removalRequested: true, state: "Under review" }),
        { quantityRequested: 3, technicalRequirements: null },
      ),
    ).toThrow(EquipmentRemovalAlreadyRequestedError);
  });

  it.each(EDITABLE)("edits a line on a %s event", (status) => {
    expect(
      editEquipmentRequirement(event({ status }), line(), {
        quantityRequested: 3,
        technicalRequirements: null,
      }).changed,
    ).toBe(true);
  });

  it.each(LOCKED)("refuses to edit a line on a %s event", (status) => {
    expect(() =>
      editEquipmentRequirement(event({ status }), line(), {
        quantityRequested: 3,
        technicalRequirements: null,
      }),
    ).toThrow(EquipmentRequirementsLockedError);
  });
});

describe("removeEquipmentRequirement (SPM-182)", () => {
  it("deletes an unreserved line", () => {
    expect(removeEquipmentRequirement(event(), line())).toEqual({ kind: "deleted" });
  });

  it("keeps a reserved line, marks its removal requested and flags it", () => {
    expect(removeEquipmentRequirement(event(), reserved())).toEqual({
      kind: "removalRequested",
      line: reserved({ removalRequested: true, state: "Under review" }),
    });
  });

  it("refuses to remove a line whose removal is already requested", () => {
    expect(() =>
      removeEquipmentRequirement(
        event(),
        reserved({ removalRequested: true, state: "Under review" }),
      ),
    ).toThrow(EquipmentRemovalAlreadyRequestedError);
  });

  it.each(EDITABLE)("removes a line on a %s event", (status) => {
    expect(removeEquipmentRequirement(event({ status }), line()).kind).toBe("deleted");
  });

  it.each(LOCKED)("refuses to remove a line on a %s event", (status) => {
    expect(() => removeEquipmentRequirement(event({ status }), line())).toThrow(
      EquipmentRequirementsLockedError,
    );
  });
});

describe("undoEquipmentRemoval (SPM-182)", () => {
  const pendingRemoval = () => reserved({ removalRequested: true, state: "Under review" });

  it("keeps the line, still under review and with its equipment held", () => {
    expect(undoEquipmentRemoval(event(), pendingRemoval())).toEqual(
      reserved({ removalRequested: false, state: "Under review" }),
    );
  });

  it("lets the coordinator edit the line again once the removal is undone", () => {
    const restored = undoEquipmentRemoval(event(), pendingRemoval());
    expect(
      editEquipmentRequirement(event(), restored, {
        quantityRequested: 3,
        technicalRequirements: "HDMI input",
      }).line.quantityRequested,
    ).toBe(3);
  });

  it("refuses to undo a removal that was never requested", () => {
    expect(() => undoEquipmentRemoval(event(), reserved())).toThrow(
      EquipmentRemovalNotRequestedError,
    );
  });

  it.each(EDITABLE)("undoes a removal on a %s event", (status) => {
    expect(undoEquipmentRemoval(event({ status }), pendingRemoval()).removalRequested).toBe(
      false,
    );
  });

  it.each(LOCKED)("refuses to undo a removal on a %s event", (status) => {
    expect(() => undoEquipmentRemoval(event({ status }), pendingRemoval())).toThrow(
      EquipmentRequirementsLockedError,
    );
  });
});

describe("recheckReason (SPM-187)", () => {
  it("AC15: names a reserved line that was changed as changed", () => {
    const edit = editEquipmentRequirement(event(), reserved(), {
      quantityRequested: 3,
      technicalRequirements: "HDMI input",
    });

    expect(recheckReason(edit.line)).toBe("changed");
  });

  it("AC15: names a reserved line whose removal was requested as removal requested", () => {
    const removal = removeEquipmentRequirement(event(), reserved());

    expect(removal.kind === "removalRequested" && recheckReason(removal.line)).toBe("removalRequested");
  });

  it("AC15: names a line whose removal was undone as changed, since it stays under review", () => {
    const removal = removeEquipmentRequirement(event(), reserved());
    const undone = removal.kind === "removalRequested" ? undoEquipmentRemoval(event(), removal.line) : null;

    expect(undone && recheckReason(undone)).toBe("changed");
  });

  it("AC15: leaves out a line that is not under review", () => {
    expect(recheckReason(line())).toBeNull();
  });

  it("AC15: leaves out an unreserved line that was changed, as nothing is held against it (AC7)", () => {
    const edit = editEquipmentRequirement(event(), line(), {
      quantityRequested: 3,
      technicalRequirements: "HDMI input",
    });

    expect(recheckReason(edit.line)).toBeNull();
  });

  it("AC15: leaves out a reserved line saved without a change (AC9)", () => {
    const edit = editEquipmentRequirement(event(), reserved(), {
      quantityRequested: 2,
      technicalRequirements: "HDMI input",
    });

    expect(recheckReason(edit.line)).toBeNull();
  });
});

describe("reverting an edit to a reserved line (SPM-232)", () => {
  const NOTES = "HDMI input";
  const change = (target: EquipmentRequirement, quantityRequested: number, technicalRequirements: string | null = NOTES) =>
    editEquipmentRequirement(event(), target, { quantityRequested, technicalRequirements });

  it("AC19: remembers what Technical Support had when a reserved line first goes under review", () => {
    const edit = change(reserved(), 1);

    expect(edit.line.state).toBe("Under review");
    expect(edit.line.reviewBaseline).toEqual({ quantityRequested: 2, technicalRequirements: NOTES });
  });

  it("AC19: returns to Reserved and clears the review when edited back to the original", () => {
    const first = change(reserved(), 1);
    const back = change(first.line, 2);

    expect(back).toMatchObject({ changed: true, underReview: false, reviewCleared: true });
    expect(back.line.state).toBe("Reserved");
    expect(back.line.reviewBaseline).toBeNull();
    expect(back.line.quantityRequested).toBe(2);
    expect(back.line.quantityReserved).toBe(2);
    expect(recheckReason(back.line)).toBeNull();
  });

  it("AC19: keeps comparing with the original across several edits", () => {
    const toOne = change(reserved(), 1);
    const toThree = change(toOne.line, 3);

    expect(toThree).toMatchObject({ underReview: true, reviewCleared: false });
    expect(toThree.line.state).toBe("Under review");
    expect(toThree.line.reviewBaseline).toEqual({ quantityRequested: 2, technicalRequirements: NOTES });
    expect(change(toThree.line, 2)).toMatchObject({ reviewCleared: true });
  });

  it("AC19: compares the technical requirements as well as the quantity", () => {
    const notesOnly = change(reserved(), 2, "HDMI and USB-C input");
    expect(change(notesOnly.line, 2, NOTES).line.state).toBe("Reserved");

    const both = change(reserved(), 1, "HDMI and USB-C input");
    const quantityOnly = change(both.line, 2, "HDMI and USB-C input");
    expect(quantityOnly.line.state).toBe("Under review");
    expect(quantityOnly.reviewCleared).toBe(false);
  });

  it("AC19: treats going back to no technical requirements as the original when there were none", () => {
    const original = reserved({ technicalRequirements: null });
    const changed = change(original, 2, "Needs a stand");

    expect(change(changed.line, 2, null)).toMatchObject({ reviewCleared: true });
  });

  it("AC19: a line that was reverted can go under review again", () => {
    const back = change(change(reserved(), 1).line, 2);
    const again = change(back.line, 1);

    expect(again.line.state).toBe("Under review");
    expect(again.line.reviewBaseline).toEqual({ quantityRequested: 2, technicalRequirements: NOTES });
  });

  it("AC19: leaves a line under review alone when the save changes nothing", () => {
    const underReview = change(reserved(), 1).line;

    expect(change(underReview, 1)).toEqual({ line: underReview, changed: false, underReview: false, reviewCleared: false });
  });

  it("AC19: remembers the original when removal of a reserved line is requested", () => {
    const removal = removeEquipmentRequirement(event(), reserved());

    expect(removal.kind === "removalRequested" && removal.line.reviewBaseline).toEqual({
      quantityRequested: 2,
      technicalRequirements: NOTES,
    });
  });

  it("AC17: an undone removal stays under review, but a later edit back to the original clears it", () => {
    const removal = removeEquipmentRequirement(event(), reserved());
    const undone = removal.kind === "removalRequested" ? undoEquipmentRemoval(event(), removal.line) : null;
    expect(undone?.state).toBe("Under review");

    const edited = change(undone as EquipmentRequirement, 3);
    expect(edited.line.state).toBe("Under review");
    expect(change(edited.line, 2)).toMatchObject({ reviewCleared: true });
  });

  it("AC7: an unreserved line never remembers anything", () => {
    const edit = change(line(), 3);

    expect(edit.line.reviewBaseline).toBeNull();
    expect(edit.reviewCleared).toBe(false);
  });
});
