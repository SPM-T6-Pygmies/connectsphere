import { describe, expect, it } from "vitest";

import { slotTimes } from "./format-event-time";

describe("slotTimes", () => {
  it("names each slot with its hours on a one-day event", () => {
    expect(slotTimes([{ date: "2026-11-04", slot: "AM" }])).toBe("AM (7:00 am – 12:00 pm)");
  });

  it("lists slots apart rather than as one range, so a gap is not claimed", () => {
    expect(
      slotTimes([
        { date: "2026-11-04", slot: "AM" },
        { date: "2026-11-04", slot: "Night" },
      ]),
    ).toBe("AM (7:00 am – 12:00 pm), Night (6:00 pm – 10:00 pm)");
  });

  it("names the day before each slot when the event runs over more than one day", () => {
    expect(
      slotTimes([
        { date: "2026-11-04", slot: "PM" },
        { date: "2026-11-05", slot: "AM" },
      ]),
    ).toBe("4 Nov PM (12:00 pm – 6:00 pm), 5 Nov AM (7:00 am – 12:00 pm)");
  });
});
