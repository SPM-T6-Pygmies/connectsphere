import { describe, expect, it } from "vitest";

import type { ChangeRequestDecidedNotice } from "@/core/ports/outbound/notifier";

import { changeRequestDecided, changeRequestDecidedInApp } from "./change-request-decided";

function notice(overrides: Partial<ChangeRequestDecidedNotice> = {}): ChangeRequestDecidedNotice {
  return {
    recipientUserAccountId: "6",
    eventId: "7",
    changeRequestId: "41",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    accepted: [{ field: "expected_attendance", value: 320 }],
    declined: [],
    ...overrides,
  };
}

describe("changeRequestDecidedInApp (SPM-110)", () => {
  it("opens the Organiser's request, where the event now stands, in the same tab", () => {
    expect(changeRequestDecidedInApp(notice()).redirect).toEqual({ url: "/staff/requester/12", target: "_self" });
  });

  it("opens the Organiser's request list when the request is gone", () => {
    expect(changeRequestDecidedInApp(notice({ eventRequestId: null })).redirect).toEqual({
      url: "/staff/requester",
      target: "_self",
    });
  });
});

describe("changeRequestDecided (SPM-110)", () => {
  it("AC5: is delivered in-app only (2026-10-18 decision)", async () => {
    const definition = await changeRequestDecided.discover();

    expect(definition.steps.map((step) => step.type)).toEqual(["in_app"]);
  });

  it("AC1: cannot be switched off, so the Organiser always learns the outcome", async () => {
    const definition = await changeRequestDecided.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });
});
