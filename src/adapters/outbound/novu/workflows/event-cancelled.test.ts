import { describe, expect, it } from "vitest";

import type { EventCancelledNotice } from "@/core/ports/outbound/notifier";

import { eventCancelledInApp } from "./event-cancelled";

function notice(overrides: Partial<EventCancelledNotice> = {}): EventCancelledNotice {
  return {
    recipientUserAccountId: "3",
    eventId: "7",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    ...overrides,
  };
}

describe("eventCancelledInApp (SPM-68)", () => {
  it("AC4: opens the Organiser's request, where the event shows as Cancelled, in the same tab", () => {
    expect(eventCancelledInApp(notice()).redirect).toEqual({ url: "/staff/requester/12", target: "_self" });
  });

  it("AC4: opens the Organiser's request list when the request is gone", () => {
    expect(eventCancelledInApp(notice({ eventRequestId: null })).redirect).toEqual({
      url: "/staff/requester",
      target: "_self",
    });
  });
});
