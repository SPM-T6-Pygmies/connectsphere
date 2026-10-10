import { describe, expect, it } from "vitest";

import type { CoordinatorEventStatus } from "./coordinator-event";
import { InvalidEventDetailsError } from "./errors";
import {
  eventDetailsEditable,
  ORDINARY_EVENT_FIELDS,
  planOrdinaryEdit,
  type OrdinaryEventDetails,
} from "./event-details-edit";

const CURRENT: OrdinaryEventDetails = {
  name: "Annual Conference",
  description: "Two days of talks.",
  purpose: null,
  categoryType: null,
  programmeAgenda: "Keynote, then panels",
  specialArrangements: null,
  accessibilityRequirements: "Step-free access",
  operationalNotes: null,
};

describe("event details edit (SPM-49)", () => {
  it("AC2: leaves date, slots, attendance, venue and equipment fields out of direct edits", () => {
    expect(ORDINARY_EVENT_FIELDS).toEqual([
      "name",
      "description",
      "purpose",
      "categoryType",
      "programmeAgenda",
      "specialArrangements",
      "accessibilityRequirements",
      "operationalNotes",
    ]);
  });

  it.each([
    ["Planning", true],
    ["Blocked", true],
    ["Confirmed", true],
    ["Completed", false],
    ["Cancelled", false],
  ] as const)("AC1: a %s event's details editable is %s", (status: CoordinatorEventStatus, editable) => {
    expect(eventDetailsEditable(status)).toBe(editable);
  });

  it("AC1: returns only the fields that changed", () => {
    expect(
      planOrdinaryEdit(CURRENT, { ...CURRENT, name: "Annual Summit", operationalNotes: "Load-in at 7am" }),
    ).toEqual({ name: "Annual Summit", operationalNotes: "Load-in at 7am" });
  });

  it("AC1: changes nothing when nothing changed, ignoring surrounding spaces", () => {
    expect(planOrdinaryEdit(CURRENT, { ...CURRENT, name: "  Annual Conference " })).toEqual({});
  });

  it("AC1: stores a cleared field as null", () => {
    expect(planOrdinaryEdit(CURRENT, { ...CURRENT, description: "   " })).toEqual({ description: null });
  });

  it("AC1: lets the coordinator clear the programme agenda, whatever the status", () => {
    expect(planOrdinaryEdit(CURRENT, { ...CURRENT, programmeAgenda: "" })).toEqual({ programmeAgenda: null });
  });

  it("AC1: refuses to clear the name", () => {
    expect(() => planOrdinaryEdit(CURRENT, { ...CURRENT, name: " " })).toThrow(InvalidEventDetailsError);
  });

  it("AC1: stores accessibility in the list's order", () => {
    expect(
      planOrdinaryEdit(CURRENT, { ...CURRENT, accessibilityRequirements: "Lift access, Step-free access" }),
    ).toEqual({ accessibilityRequirements: "Step-free access, Lift access" });
  });

  it("AC1: refuses an accessibility value that is not on the list, naming it", () => {
    expect(() =>
      planOrdinaryEdit(CURRENT, { ...CURRENT, accessibilityRequirements: "Step-free access, Ramp" }),
    ).toThrow(/Ramp is not an accessibility option/);
  });

  it("AC1: keeps an older free-text accessibility value when something else changes", () => {
    const legacy = { ...CURRENT, accessibilityRequirements: "Step-free access for two attendees." };
    expect(planOrdinaryEdit(legacy, { ...legacy, purpose: "Team offsite" })).toEqual({ purpose: "Team offsite" });
  });
});
