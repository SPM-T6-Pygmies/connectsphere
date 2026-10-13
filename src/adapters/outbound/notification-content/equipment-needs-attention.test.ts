import { describe, expect, it } from "vitest";

import type { EquipmentNeedsAttentionNotice } from "@/core/ports/outbound/notifier";

import { equipmentNeedsAttentionMessage } from "./equipment-needs-attention";

function notice(overrides: Partial<EquipmentNeedsAttentionNotice> = {}): EquipmentNeedsAttentionNotice {
  return {
    recipientUserAccountId: "5",
    eventId: "12",
    eventName: "Tech Summit Keynote",
    preferredDate: "2026-11-15",
    equipmentType: "Projector",
    quantityRequested: 4,
    reason: "new",
    quantityWas: null,
    ...overrides,
  };
}

describe("equipmentNeedsAttentionMessage (SPM-64)", () => {
  it("AC5: names a new line's type, quantity, event and date", () => {
    expect(equipmentNeedsAttentionMessage(notice())).toEqual({
      subject: "Projector requested for Tech Summit Keynote",
      body: "4 requested. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC2: a changed line says what it was and that the earlier decision needs re-review", () => {
    expect(equipmentNeedsAttentionMessage(notice({ reason: "changed", quantityRequested: 6, quantityWas: 4 }))).toEqual({
      subject: "Projector changed on Tech Summit Keynote",
      body: "Now 6 requested, was 4. The earlier decision needs re-review. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC2: a line whose technical requirements changed, not its quantity, says so", () => {
    expect(equipmentNeedsAttentionMessage(notice({ reason: "changed", quantityWas: 4 })).body).toBe(
      "Technical requirements changed; 4 requested. The earlier decision needs re-review. Event date: Sun, 15 Nov 2026.",
    );
  });

  it("AC2: a removal request says the reservation needs re-review", () => {
    expect(equipmentNeedsAttentionMessage(notice({ reason: "removalRequested" }))).toEqual({
      subject: "Projector removal requested on Tech Summit Keynote",
      body: "The coordinator asked to remove this line. Its reservation needs re-review. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC5: says when the event has no date yet", () => {
    expect(equipmentNeedsAttentionMessage(notice({ preferredDate: null })).body).toBe("4 requested. No event date set yet.");
  });
});
