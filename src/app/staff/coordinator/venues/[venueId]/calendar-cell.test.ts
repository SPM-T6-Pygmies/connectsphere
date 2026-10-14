import { describe, expect, it } from "vitest";

import type { CalendarSlot } from "@/core/domain/venue-calendar";

import { calendarCell, dayHeading } from "./calendar-cell";

function slot(overrides: Partial<CalendarSlot>): CalendarSlot {
  return { slot: "AM", status: "available", holdExpiresAt: null, reasons: [], ...overrides };
}

describe("calendarCell (SPM-155)", () => {
  it("shows an open slot as Available, with nothing more to say", () => {
    expect(calendarCell(slot({}))).toEqual({ label: "Available", variant: "success", detail: null });
  });

  it("shows a Confirmed booking as Confirmed", () => {
    expect(calendarCell(slot({ status: "booked" }))).toMatchObject({ label: "Confirmed", detail: null });
  });

  it("shows a hold with when it lapses, in the words the other hold pages use", () => {
    const cell = calendarCell(
      slot({ status: "held", holdExpiresAt: new Date("2026-11-05T04:00:00Z") }),
    );

    expect(cell).toMatchObject({ label: "Held", variant: "warning" });
    expect(cell.detail).toBe("Until Thu, 5 Nov, 12:00 pm");
  });

  it("shows a hold with no expiry without inventing one", () => {
    expect(calendarCell(slot({ status: "held" })).detail).toBeNull();
  });

  it("shows a blocked slot with the reason Venue Staff recorded", () => {
    expect(calendarCell(slot({ status: "blocked", reasons: ["Renovation"] }))).toEqual({
      label: "Blocked",
      variant: "destructive",
      detail: "Renovation",
    });
  });

  it("lists every reason when overlapping blocks cover the slot", () => {
    expect(calendarCell(slot({ status: "blocked", reasons: ["Renovation", "Safety"] })).detail).toBe(
      "Renovation, Safety",
    );
  });

  it("shows a blocked slot with no reason without failing", () => {
    expect(calendarCell(slot({ status: "blocked" })).detail).toBeNull();
  });

  it("shows a slot the venue never offers as Not offered", () => {
    expect(calendarCell(slot({ status: "notOffered" }))).toMatchObject({ label: "Not offered" });
  });
});

describe("dayHeading (SPM-155)", () => {
  it("names the weekday and date of a calendar day, whatever the server's zone", () => {
    expect(dayHeading("2026-11-02")).toBe("Mon, 2 Nov");
  });
});
