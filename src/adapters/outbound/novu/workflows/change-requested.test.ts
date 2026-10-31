import { describe, expect, it } from "vitest";

import type { ChangeRequestedNotice } from "@/core/ports/outbound/notifier";

import { changeRequested, changeRequestedInApp } from "./change-requested";

function notice(overrides: Partial<ChangeRequestedNotice> = {}): ChangeRequestedNotice {
  return {
    recipientUserAccountId: "3",
    eventId: "7",
    changeRequestId: "41",
    eventName: "Marina Bay Gala",
    changes: [{ field: "expected_attendance", value: 320 }],
    ...overrides,
  };
}

describe("changeRequestedInApp (SPM-67)", () => {
  it("AC4: opens the event's change request, where the coordinator decides it, in the same tab", () => {
    expect(changeRequestedInApp(notice()).redirect).toEqual({
      url: "/staff/coordinator/events/7/change-request",
      target: "_self",
    });
  });
});

describe("changeRequested (SPM-67)", () => {
  it("AC1: is delivered in-app only (2026-10-18 decision)", async () => {
    const definition = await changeRequested.discover();

    expect(definition.steps.map((step) => step.type)).toEqual(["in_app"]);
  });

  it("AC1: cannot be switched off, so the coordinator always learns of a change request", async () => {
    const definition = await changeRequested.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });
});
