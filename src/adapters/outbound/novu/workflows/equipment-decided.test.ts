import { describe, expect, it } from "vitest";

import { equipmentDecided, equipmentDecidedInApp } from "./equipment-decided";

describe("equipmentDecidedInApp (SPM-65)", () => {
  it("AC5: opens the event's Equipment tab in the coordinator's workspace, in the same tab", () => {
    const inApp = equipmentDecidedInApp({
      recipientUserAccountId: "3",
      eventId: "12",
      eventName: "Design Sprint Demo",
      preferredDate: "2026-11-20",
      lines: [],
    });

    expect(inApp.redirect).toEqual({ url: "/staff/coordinator/events/12?tab=equipment", target: "_self" });
  });
});

describe("equipmentDecided (SPM-65)", () => {
  it("AC1: cannot be switched off, so the coordinator always gets it", async () => {
    const definition = await equipmentDecided.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });
});
