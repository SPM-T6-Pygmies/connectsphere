import { describe, expect, it } from "vitest";

import { shortDaysText } from "./short-days-text";

const designSprint = { eventId: "1", eventName: "Design Sprint Demo", eventDate: "2026-11-20", quantityReserved: 6 };
const salesKickoff = { eventId: "2", eventName: "Sales Kickoff", eventDate: "2026-11-21", quantityReserved: 2 };

describe("shortDaysText (SPM-274)", () => {
  it("AC7: names the day, what is reserved against what is in service, and each event's reservation", () => {
    expect(
      shortDaysText({ from: "2026-11-20", to: "2026-11-20", reserved: 8, events: [designSprint, salesKickoff] }, 7),
    ).toBe(
      "20 Nov (8 reserved but only 7 in service): Design Sprint Demo (20 Nov) has 6 reserved, Sales Kickoff (21 Nov) has 2 reserved",
    );
  });

  it("AC7: writes a run of days in one month as a range", () => {
    expect(shortDaysText({ from: "2026-11-19", to: "2026-11-20", reserved: 6, events: [designSprint] }, 5)).toBe(
      "19–20 Nov (6 reserved but only 5 in service): Design Sprint Demo (20 Nov) has 6 reserved",
    );
  });

  it("AC7: writes a run across two months with both months", () => {
    const event = { ...designSprint, eventDate: "2026-12-01" };

    expect(shortDaysText({ from: "2026-11-30", to: "2026-12-01", reserved: 6, events: [event] }, 5)).toBe(
      "30 Nov – 1 Dec (6 reserved but only 5 in service): Design Sprint Demo (1 Dec) has 6 reserved",
    );
  });
});
