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
  return {
    equipmentItemId: PROJECTOR,
    quantityRequested: 2,
    technicalRequirements: "HDMI input",
    quantityReserved: 0,
    recheckRequired: false,
    removalRequested: false,
    ...overrides,
  };
}

const reserved = (overrides: Partial<EquipmentRequirement> = {}) =>
  line({ quantityReserved: 2, ...overrides });

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
  it("records a new line with nothing reserved and nothing flagged", () => {
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
      recheckRequired: false,
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
        [reserved({ removalRequested: true, recheckRequired: true })],
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
  it("saves a change to an unreserved line without flagging it", () => {
    expect(
      editEquipmentRequirement(event(), line(), {
        quantityRequested: 3,
        technicalRequirements: "HDMI input",
      }),
    ).toEqual({
      line: line({ quantityRequested: 3 }),
      changed: true,
      flagged: false,
    });
  });

  it("saves a quantity change to a reserved line, flags it and keeps its equipment held", () => {
    expect(
      editEquipmentRequirement(event(), reserved(), {
        quantityRequested: 4,
        technicalRequirements: "HDMI input",
      }),
    ).toEqual({
      line: reserved({ quantityRequested: 4, recheckRequired: true }),
      changed: true,
      flagged: true,
    });
  });

  it("flags a reserved line whose technical requirements alone change", () => {
    const edit = editEquipmentRequirement(event(), reserved(), {
      quantityRequested: 2,
      technicalRequirements: "HDMI and USB-C input",
    });
    expect(edit.flagged).toBe(true);
    expect(edit.line.technicalRequirements).toBe("HDMI and USB-C input");
    expect(edit.line.recheckRequired).toBe(true);
  });

  it("keeps a reserved line's equipment held when the quantity drops below what was reserved", () => {
    const edit = editEquipmentRequirement(event(), reserved({ quantityReserved: 2 }), {
      quantityRequested: 1,
      technicalRequirements: "HDMI input",
    });
    expect(edit.line.quantityRequested).toBe(1);
    expect(edit.line.quantityReserved).toBe(2);
    expect(edit.flagged).toBe(true);
  });

  it("leaves a reserved line unflagged when the save changes nothing", () => {
    const original = reserved();
    expect(
      editEquipmentRequirement(event(), original, {
        quantityRequested: 2,
        technicalRequirements: "HDMI input",
      }),
    ).toEqual({ line: original, changed: false, flagged: false });
  });

  it("treats blank technical requirements as unchanged from none", () => {
    expect(
      editEquipmentRequirement(event(), reserved({ technicalRequirements: null }), {
        quantityRequested: 2,
        technicalRequirements: "  ",
      }).changed,
    ).toBe(false);
  });

  it("does not clear an earlier re-check flag", () => {
    const edit = editEquipmentRequirement(event(), line({ recheckRequired: true }), {
      quantityRequested: 3,
      technicalRequirements: "HDMI input",
    });
    expect(edit.flagged).toBe(false);
    expect(edit.line.recheckRequired).toBe(true);
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
        reserved({ removalRequested: true, recheckRequired: true }),
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
      line: reserved({ removalRequested: true, recheckRequired: true }),
    });
  });

  it("refuses to remove a line whose removal is already requested", () => {
    expect(() =>
      removeEquipmentRequirement(
        event(),
        reserved({ removalRequested: true, recheckRequired: true }),
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
  const pendingRemoval = () => reserved({ removalRequested: true, recheckRequired: true });

  it("keeps the line, still flagged for re-check and with its equipment held", () => {
    expect(undoEquipmentRemoval(event(), pendingRemoval())).toEqual(
      reserved({ removalRequested: false, recheckRequired: true }),
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
