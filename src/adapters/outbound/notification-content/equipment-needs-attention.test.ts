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
    change: "added",
    quantityRequested: 4,
    quantityWas: null,
    attention: "new",
    ...overrides,
  };
}

const edited = (overrides: Partial<EquipmentNeedsAttentionNotice>) =>
  equipmentNeedsAttentionMessage(notice({ change: "edited", quantityRequested: 6, quantityWas: 4, ...overrides }));

describe("equipmentNeedsAttentionMessage (SPM-64)", () => {
  it("AC5: names a new line's type, quantity, event and date", () => {
    expect(equipmentNeedsAttentionMessage(notice())).toEqual({
      subject: "Projector requested for Tech Summit Keynote",
      body: "4 requested. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC2: a changed decision says what it was and that it needs re-review", () => {
    expect(edited({ attention: "changed" })).toEqual({
      subject: "Projector changed on Tech Summit Keynote",
      body: "Now 6 requested, was 4. The earlier decision needs re-review. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC2: an edit back to what was decided says the decision stands", () => {
    expect(edited({ attention: null }).body).toBe(
      "Now 6 requested, was 4. That is what was decided, so the earlier decision stands. Event date: Sun, 15 Nov 2026.",
    );
  });

  it("AC2: an edit to a line not yet decided says it still awaits a decision", () => {
    expect(edited({ attention: "new" }).body).toBe(
      "Now 6 requested, was 4. It still awaits a decision. Event date: Sun, 15 Nov 2026.",
    );
  });

  it("AC5: a line whose technical requirements changed, not its quantity, says so", () => {
    expect(edited({ quantityRequested: 4, quantityWas: null, attention: "changed" }).body).toBe(
      "Technical requirements changed; 4 requested. The earlier decision needs re-review. Event date: Sun, 15 Nov 2026.",
    );
  });

  it("AC2: a deleted line says there is nothing to do", () => {
    expect(equipmentNeedsAttentionMessage(notice({ change: "deleted", attention: null }))).toEqual({
      subject: "Projector removed from Tech Summit Keynote",
      body: "The coordinator removed this line. Nothing was reserved, so there is nothing to do. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC2: a removal request says the reservation needs re-review", () => {
    expect(equipmentNeedsAttentionMessage(notice({ change: "removalRequested", attention: "removalRequested" }))).toEqual({
      subject: "Projector removal requested on Tech Summit Keynote",
      body: "The coordinator asked to remove this line. Its reservation needs re-review. Event date: Sun, 15 Nov 2026.",
    });
  });

  it("AC2: a withdrawn removal says whether the reservation stands", () => {
    expect(equipmentNeedsAttentionMessage(notice({ change: "removalWithdrawn", attention: null }))).toEqual({
      subject: "Projector removal withdrawn on Tech Summit Keynote",
      body: "The coordinator is keeping this line. Its reservation stands. Event date: Sun, 15 Nov 2026.",
    });
    expect(equipmentNeedsAttentionMessage(notice({ change: "removalWithdrawn", attention: "changed" })).body).toBe(
      "The coordinator is keeping this line. It still needs re-review as changed. Event date: Sun, 15 Nov 2026.",
    );
  });

  it("AC5: says when the event has no date yet", () => {
    expect(equipmentNeedsAttentionMessage(notice({ preferredDate: null })).body).toBe("4 requested. No event date set yet.");
  });
});
