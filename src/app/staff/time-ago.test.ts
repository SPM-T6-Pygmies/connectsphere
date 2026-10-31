import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { timeAgo } from "./time-ago";

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the activity feed's space-separated timestamp and an ISO one alike", () => {
    expect(timeAgo("2026-09-07 12:00")).toBe("3d ago");
    expect(timeAgo("2026-09-07T12:00:00")).toBe("3d ago");
  });

  it.each([
    ["2026-09-10T11:59:30", "just now"],
    ["2026-09-10T11:59:00", "1m ago"],
    ["2026-09-10T11:00:00", "1h ago"],
    ["2026-09-09T12:00:00", "1d ago"],
    ["2026-08-11T12:00:00", "1mo ago"],
    ["2025-09-10T12:00:00", "1y ago"],
  ])("rounds %s down to %s at each unit's boundary", (timestamp, expected) => {
    expect(timeAgo(timestamp)).toBe(expected);
  });

  it("says just now for a timestamp ahead of the clock", () => {
    expect(timeAgo("2026-09-10T12:05:00")).toBe("just now");
  });
});
