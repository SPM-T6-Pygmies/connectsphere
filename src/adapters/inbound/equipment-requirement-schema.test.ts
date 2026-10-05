import { describe, expect, it } from "vitest";

import {
  addEquipmentRequirementSchema,
  editEquipmentRequirementSchema,
  equipmentLineSchema,
} from "./equipment-requirement-schema";

const ADD = { eventId: "event-1", equipmentItemId: "item-projector", quantityRequested: "2", technicalRequirements: "HDMI input" };

describe("addEquipmentRequirementSchema (SPM-186)", () => {
  it("AC1: accepts a catalogue type, a quantity and notes, with the quantity as a number", () => {
    const parsed = addEquipmentRequirementSchema.safeParse(ADD);

    expect(parsed.success && parsed.data).toEqual({
      eventId: "event-1",
      equipmentItemId: "item-projector",
      quantityRequested: 2,
      technicalRequirements: "HDMI input",
    });
  });

  it("AC1: accepts a line with no notes", () => {
    const parsed = addEquipmentRequirementSchema.safeParse({ ...ADD, technicalRequirements: "" });

    expect(parsed.success).toBe(true);
  });

  it("AC3: reads 1 as the number 1", () => {
    const parsed = addEquipmentRequirementSchema.safeParse({ ...ADD, quantityRequested: "1" });

    expect(parsed.success && parsed.data.quantityRequested).toBe(1);
  });

  it.each(["0", "1.5", "-2"])("AC3: passes %s on as a number, for the domain to reject", (typed) => {
    const parsed = addEquipmentRequirementSchema.safeParse({ ...ADD, quantityRequested: typed });

    expect(parsed.success && parsed.data.quantityRequested).toBe(Number(typed));
  });

  it.each(["", "   ", "two", "1e3x"])("AC3: rejects a quantity that is not a number (%j)", (typed) => {
    const parsed = addEquipmentRequirementSchema.safeParse({ ...ADD, quantityRequested: typed });

    expect(parsed.success).toBe(false);
  });

  it("AC4: rejects a missing equipment type", () => {
    const parsed = addEquipmentRequirementSchema.safeParse({ ...ADD, equipmentItemId: "  " });

    expect(parsed.success).toBe(false);
  });

  it("AC5: leaves the notes length to the domain rather than refusing its shape", () => {
    const parsed = addEquipmentRequirementSchema.safeParse({
      ...ADD,
      technicalRequirements: "x".repeat(501),
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing event", () => {
    const parsed = addEquipmentRequirementSchema.safeParse({ ...ADD, eventId: "" });

    expect(parsed.success).toBe(false);
  });
});

describe("editEquipmentRequirementSchema (SPM-186)", () => {
  it("AC7: accepts a new quantity and notes for a line, with the quantity as a number", () => {
    const parsed = editEquipmentRequirementSchema.safeParse({ ...ADD, quantityRequested: "3" });

    expect(parsed.success && parsed.data).toEqual({
      eventId: "event-1",
      equipmentItemId: "item-projector",
      quantityRequested: 3,
      technicalRequirements: "HDMI input",
    });
  });

  it("AC3: rejects a quantity that is not a number", () => {
    const parsed = editEquipmentRequirementSchema.safeParse({ ...ADD, quantityRequested: "lots" });

    expect(parsed.success).toBe(false);
  });

  it("rejects an edit that names no line", () => {
    const parsed = editEquipmentRequirementSchema.safeParse({ ...ADD, equipmentItemId: "" });

    expect(parsed.success).toBe(false);
  });
});

describe("equipmentLineSchema (SPM-186)", () => {
  it("AC10: accepts an event and a line to remove", () => {
    const parsed = equipmentLineSchema.safeParse({ eventId: "event-1", equipmentItemId: "item-projector" });

    expect(parsed.success).toBe(true);
  });

  it("AC17: rejects an undo that names no line", () => {
    const parsed = equipmentLineSchema.safeParse({ eventId: "event-1", equipmentItemId: "" });

    expect(parsed.success).toBe(false);
  });

  it("rejects a missing event", () => {
    const parsed = equipmentLineSchema.safeParse({ eventId: " ", equipmentItemId: "item-projector" });

    expect(parsed.success).toBe(false);
  });
});
