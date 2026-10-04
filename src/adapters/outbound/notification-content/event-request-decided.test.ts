import { describe, expect, it } from "vitest";

import type { EventRequestDecidedNotice } from "@/core/ports/outbound/notifier";

import { eventRequestDecidedMessage } from "./event-request-decided";

function notice(overrides: Partial<EventRequestDecidedNotice> = {}): EventRequestDecidedNotice {
  return {
    recipientUserAccountId: "3",
    eventRequestId: "42",
    eventName: "Founders' Day",
    decision: "approved",
    decisionRecord: null,
    ...overrides,
  };
}

describe("eventRequestDecidedMessage (SPM-60)", () => {
  it("AC1, AC2: an approval says planning may begin but nothing is committed yet", () => {
    expect(eventRequestDecidedMessage(notice())).toEqual({
      subject: "Founders' Day was approved",
      body: "Your coordinator approved Founders' Day. Planning can begin, but ConnectSphere is not yet committed to any arrangement.",
    });
  });

  it("adds the coordinator's note to an approval when there is one", () => {
    expect(eventRequestDecidedMessage(notice({ decisionRecord: "Venue to follow." })).body).toBe(
      "Your coordinator approved Founders' Day. Planning can begin, but ConnectSphere is not yet committed to any arrangement. Note: Venue to follow.",
    );
  });

  it("AC1, AC3: a rejection carries the coordinator's reason", () => {
    expect(
      eventRequestDecidedMessage(
        notice({ decision: "rejected", decisionRecord: "The date clashes with a closure." }),
      ),
    ).toEqual({
      subject: "Founders' Day was rejected",
      body: "Your coordinator rejected Founders' Day. Reason: The date clashes with a closure.",
    });
  });
});
