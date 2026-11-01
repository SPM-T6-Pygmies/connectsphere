import { describe, expect, it } from "vitest";

import type { EquipmentQueueEntry } from "@/core/use-cases/list-equipment-queue";

import { queueTeaser } from "./queue-teaser";

function entry(
  lineCount: number,
  linesNeedingAttention: number,
  linesUnfulfilled = 0,
  linesRescheduled = 0,
): EquipmentQueueEntry {
  return {
    eventId: "1",
    eventName: "Founders' Gala Dinner",
    preferredDate: "2026-11-15",
    status: "Planning",
    lineCount,
    linesNeedingAttention,
    linesRescheduled,
    linesUnfulfilled,
  };
}

describe("queueTeaser (SPM-273)", () => {
  it("AC1: says how many lines need attention, out of how many", () => {
    expect(queueTeaser("needsReview", entry(3, 1))).toBe("1 line of 3 needs attention");
    expect(queueTeaser("needsReview", entry(3, 2))).toBe("2 lines of 3 need attention");
    expect(queueTeaser("needsReview", entry(1, 1))).toBe("1 line of 1 needs attention");
  });
});

describe("queueTeaser (SPM-274)", () => {
  it("AC3: on Reviewed, says how many lines are unfulfilled, or that all are reserved", () => {
    expect(queueTeaser("reviewed", entry(3, 0))).toBe("3 lines, all reserved");
    expect(queueTeaser("reviewed", entry(3, 0, 1))).toBe("3 lines, 1 unfulfilled");
  });
});

describe("queueTeaser (SPM-311)", () => {
  it("AC1: on Needs review, says how many of the lines a change of dates released", () => {
    expect(queueTeaser("needsReview", entry(3, 2, 0, 2))).toBe("2 lines of 3 need attention, 2 rescheduled");
    expect(queueTeaser("needsReview", entry(3, 2, 0, 1))).toBe("2 lines of 3 need attention, 1 rescheduled");
  });

  it("AC1: says nothing of rescheduling when no line was released", () => {
    expect(queueTeaser("needsReview", entry(3, 2, 0, 0))).toBe("2 lines of 3 need attention");
  });
});
