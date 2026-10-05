import { describe, expect, it } from "vitest";

import { slotsByEvent } from "./event-mapper";

describe("slotsByEvent", () => {
  it("groups each event's slots, keeping the order they were returned in", () => {
    const slots = slotsByEvent([
      { event_id: 1, date: "2026-11-04", slot: "AM" },
      { event_id: 2, date: "2026-11-05", slot: "Night" },
      { event_id: 1, date: "2026-11-04", slot: "PM" },
    ]);

    expect(slots.get(1)).toEqual([
      { date: "2026-11-04", slot: "AM" },
      { date: "2026-11-04", slot: "PM" },
    ]);
    expect(slots.get(2)).toEqual([{ date: "2026-11-05", slot: "Night" }]);
    expect(slots.has(3)).toBe(false);
  });

  it("refuses a slot the slot table should never hold", () => {
    expect(() => slotsByEvent([{ event_id: 1, date: "2026-11-04", slot: "Evening" }])).toThrow();
  });
});
