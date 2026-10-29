import { describe, expect, it } from "vitest";

import type { EventRescheduledNotice } from "@/core/ports/outbound/notifier";

import { eventRescheduledInApp } from "./event-rescheduled";

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

describe("eventRescheduledInApp (SPM-68)", () => {
  it("AC4: opens the Organiser's request, where the new times are shown, in the same tab", () => {
    expect(eventRescheduledInApp(notice()).redirect).toEqual({ url: "/staff/requester/12", target: "_self" });
  });

  it("AC4: opens the Organiser's request list when the request is gone", () => {
    expect(eventRescheduledInApp(notice({ eventRequestId: null })).redirect).toEqual({
      url: "/staff/requester",
      target: "_self",
    });
  });
});
