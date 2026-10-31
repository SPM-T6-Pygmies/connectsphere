import { describe, expect, it } from "vitest";

import type { EventNoLongerConfirmedNotice } from "@/core/ports/outbound/notifier";

import { eventNoLongerConfirmed, eventNoLongerConfirmedInApp } from "./event-no-longer-confirmed";

function notice(overrides: Partial<EventNoLongerConfirmedNotice> = {}): EventNoLongerConfirmedNotice {
  return {
    recipientUserAccountId: "6",
    eventId: "7",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    lapsed: [{ kind: "safety-check" }],
    ...overrides,
  };
}

describe("eventNoLongerConfirmedInApp (SPM-111)", () => {
  it("opens the Organiser's request, where the event shows Planning, in the same tab", () => {
    expect(eventNoLongerConfirmedInApp(notice()).redirect).toEqual({ url: "/staff/requester/12", target: "_self" });
  });

  it("opens the Organiser's request list when the request is gone", () => {
    expect(eventNoLongerConfirmedInApp(notice({ eventRequestId: null })).redirect).toEqual({
      url: "/staff/requester",
      target: "_self",
    });
  });
});

describe("eventNoLongerConfirmed (SPM-111)", () => {
  it("is delivered in-app only (2026-10-18 decision)", async () => {
    const definition = await eventNoLongerConfirmed.discover();

    expect(definition.steps.map((step) => step.type)).toEqual(["in_app"]);
  });

  it("AC1: cannot be switched off, so the Organiser always learns the event lapsed", async () => {
    const definition = await eventNoLongerConfirmed.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });
});
