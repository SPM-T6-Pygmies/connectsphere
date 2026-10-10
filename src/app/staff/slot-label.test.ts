import { describe, expect, it } from "vitest";

import { slotLabel } from "./slot-label";

describe("slotLabel (SPM-46)", () => {
  it("names each slot with its hours", () => {
    expect(slotLabel("AM")).toBe("AM (7:00 AM – 12:00 PM)");
    expect(slotLabel("PM")).toBe("PM (1:00 PM – 6:00 PM)");
  });

  it("shows Night ending at midnight as 12:00 AM", () => {
    expect(slotLabel("Night")).toBe("Night (7:00 PM – 12:00 AM)");
  });
});
