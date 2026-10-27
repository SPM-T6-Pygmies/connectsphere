import { describe, expect, it } from "vitest";

import type { EventConfirmedNotice } from "@/core/ports/outbound/notifier";

import { eventConfirmedInApp } from "./event-confirmed";

function notice(overrides: Partial<EventConfirmedNotice> = {}): EventConfirmedNotice {
  return {
    recipientUserAccountId: "3",
    eventId: "7",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    times: [],
    venueLocation: null,
    equipment: [],
    ...overrides,
  };
}

describe("eventConfirmedInApp (SPM-66)", () => {
  it("AC3: opens the Organiser's request, where the confirmed arrangements are shown, in the same tab", () => {
    expect(eventConfirmedInApp(notice()).redirect).toEqual({ url: "/staff/requester/12", target: "_self" });
  });

  it("opens the Organiser's request list when the request is gone", () => {
    expect(eventConfirmedInApp(notice({ eventRequestId: null })).redirect).toEqual({
      url: "/staff/requester",
      target: "_self",
    });
  });
});
