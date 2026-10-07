import { describe, expect, it } from "vitest";

import type { EquipmentQueueEntry } from "@/core/use-cases/list-equipment-queue";

import { queueTeaser } from "./queue-teaser";

function entry(lineCount: number, linesNeedingAttention: number): EquipmentQueueEntry {
  return {
    eventId: "1",
    eventName: "Founders' Gala Dinner",
    preferredDate: "2026-11-15",
    status: "Planning",
    lineCount,
    linesNeedingAttention,
  };
}

describe("queueTeaser (SPM-273)", () => {
  it("AC1: says how many lines need attention, out of how many", () => {
    expect(queueTeaser("needsReview", entry(3, 1))).toBe("1 line of 3 needs attention");
    expect(queueTeaser("needsReview", entry(3, 2))).toBe("2 lines of 3 need attention");
    expect(queueTeaser("needsReview", entry(1, 1))).toBe("1 line of 1 needs attention");
  });

  it("says a reviewed event's lines are all reserved", () => {
    expect(queueTeaser("reviewed", entry(1, 0))).toBe("1 line, all reserved");
    expect(queueTeaser("reviewed", entry(4, 0))).toBe("4 lines, all reserved");
  });

  it("counts an archived event's lines", () => {
    expect(queueTeaser("archive", entry(2, 1))).toBe("2 lines");
  });
});
