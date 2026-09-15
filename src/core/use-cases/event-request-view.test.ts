import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";

import { toEventRequestView } from "./event-request-view";

describe("toEventRequestView", () => {
  it("carries the request as plain data, with submittedAt as ISO 8601", () => {
    const request = eventRequestFixture({
      status: "Rejected",
      decisionRecord: "No expected attendance.",
      submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    });

    expect(toEventRequestView(request)).toEqual({
      id: request.id,
      status: "Rejected",
      details: request.details,
      decisionRecord: "No expected attendance.",
      submittedAt: "2026-09-10T00:00:00.000Z",
    });
  });

  it("leaves submittedAt null for a request still in Draft", () => {
    expect(
      toEventRequestView(eventRequestFixture({ status: "Draft", submittedAt: null })).submittedAt,
    ).toBeNull();
  });
});
