import { describe, expect, it } from "vitest";

import type { EventRescheduledNotice } from "@/core/ports/outbound/notifier";

import { eventRescheduledMessage } from "./event-rescheduled";

function notice(overrides: Partial<EventRescheduledNotice> = {}): EventRescheduledNotice {
  return {
    recipientUserAccountId: "3",
    eventId: "7",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    times: [{ date: "2026-11-20", start: "09:00", end: "12:00" }],
    backToPlanning: false,
    ...overrides,
  };
}

describe("eventRescheduledMessage (SPM-68)", () => {
  it("AC1, AC2: says the event is rescheduled and gives its new date and time", () => {
    expect(eventRescheduledMessage(notice())).toEqual({
      subject: "Marina Bay Gala is rescheduled",
      body: "Marina Bay Gala has been rescheduled. New times: Fri, 20 Nov 2026 (09:00–12:00).",
    });
  });

  it("AC2: lists every new date, and every time on a date", () => {
    const times = [
      { date: "2026-11-20", start: "09:00", end: "12:00" },
      { date: "2026-11-20", start: "14:00", end: "17:00" },
      { date: "2026-11-21", start: "10:00", end: "24:00" },
    ];

    expect(eventRescheduledMessage(notice({ times })).body).toBe(
      "Marina Bay Gala has been rescheduled. New times: Fri, 20 Nov 2026 (09:00–12:00, 14:00–17:00) and Sat, 21 Nov 2026 (10:00–24:00).",
    );
  });

  it("AC2: says the event is back in Planning when the change took it out of Confirmed", () => {
    expect(eventRescheduledMessage(notice({ backToPlanning: true })).body).toBe(
      "Marina Bay Gala has been rescheduled. New times: Fri, 20 Nov 2026 (09:00–12:00). It is back in Planning until its arrangements are confirmed again.",
    );
  });
});
