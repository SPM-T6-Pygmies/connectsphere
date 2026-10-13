import { describe, expect, it } from "vitest";

import { equipmentNeedsAttention, equipmentNeedsAttentionInApp } from "./equipment-needs-attention";

describe("equipmentNeedsAttentionInApp (SPM-64)", () => {
  it("AC6: opens the event in the Technical Support workspace, in the same tab", () => {
    const inApp = equipmentNeedsAttentionInApp({
      recipientUserAccountId: "5",
      eventId: "12",
      eventName: "Tech Summit Keynote",
      preferredDate: "2026-11-15",
      equipmentType: "Projector",
      change: "added",
      quantityRequested: 4,
      quantityWas: null,
      attention: "new",
    });

    expect(inApp.redirect).toEqual({ url: "/staff/technical/12", target: "_self" });
  });
});

describe("equipmentNeedsAttention (SPM-64)", () => {
  it("AC1: cannot be switched off, so every Technical Support Staff member gets it", async () => {
    const definition = await equipmentNeedsAttention.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });
});
