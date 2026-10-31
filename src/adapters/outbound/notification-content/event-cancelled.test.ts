import { describe, expect, it } from "vitest";

import { eventCancelledMessage } from "./event-cancelled";

describe("eventCancelledMessage (SPM-68)", () => {
  it("AC1, AC3: says the event is cancelled and its venue and equipment are released", () => {
    expect(
      eventCancelledMessage({
        recipientUserAccountId: "3",
        eventId: "7",
        eventRequestId: "12",
        eventName: "Marina Bay Gala",
      }),
    ).toEqual({
      subject: "Marina Bay Gala is cancelled",
      body: "Marina Bay Gala has been cancelled. Its venue bookings and equipment reservations have been released.",
    });
  });
});
