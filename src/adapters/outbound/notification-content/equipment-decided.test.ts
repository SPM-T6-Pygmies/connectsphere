import { describe, expect, it } from "vitest";

import type { EquipmentDecidedNotice, EquipmentLineOutcome } from "@/core/ports/outbound/notifier";

import { equipmentDecidedMessage } from "./equipment-decided";

const projector: EquipmentLineOutcome = {
  equipmentType: "Projector",
  quantityRequested: 4,
  outcome: "reserved",
  quantityReserved: 4,
  decidedByName: "Test Support Staff",
  comment: null,
};

const speaker: EquipmentLineOutcome = {
  equipmentType: "PA speaker",
  quantityRequested: 3,
  outcome: "unfulfilled",
  quantityReserved: 0,
  decidedByName: "Test Support Staff 2",
  comment: "only 2 available",
};

function notice(lines: readonly EquipmentLineOutcome[], preferredDate: string | null = "2026-11-20"): EquipmentDecidedNotice {
  return { recipientUserAccountId: "3", eventId: "12", eventName: "Design Sprint Demo", preferredDate, lines };
}

describe("equipmentDecidedMessage (SPM-65)", () => {
  it("AC3: says everything was reserved, with each line's quantity and who reserved it", () => {
    expect(equipmentDecidedMessage(notice([projector, { ...projector, equipmentType: "Wireless microphone", quantityReserved: 2 }]))).toEqual({
      subject: "Equipment reserved for Design Sprint Demo",
      body: "Projector: 4 reserved by Test Support Staff. Wireless microphone: 2 reserved by Test Support Staff. Event date: Fri, 20 Nov 2026.",
    });
  });

  it("AC3: counts the unfulfilled lines, and gives each one's reason and who marked it", () => {
    expect(equipmentDecidedMessage(notice([speaker, projector]))).toEqual({
      subject: "Equipment for Design Sprint Demo: 1 of 2 lines unfulfilled",
      body: "PA speaker: unfulfilled (only 2 available), marked by Test Support Staff 2. Projector: 4 reserved by Test Support Staff. Event date: Fri, 20 Nov 2026.",
    });
  });

  it("AC3: a single unfulfilled line reads as one line", () => {
    expect(equipmentDecidedMessage(notice([speaker])).subject).toBe("Equipment for Design Sprint Demo: 1 of 1 line unfulfilled");
  });

  it("AC3: leaves out who decided a line when that was never recorded", () => {
    expect(equipmentDecidedMessage(notice([{ ...projector, decidedByName: null }])).body).toBe(
      "Projector: 4 reserved. Event date: Fri, 20 Nov 2026.",
    );
  });
});
