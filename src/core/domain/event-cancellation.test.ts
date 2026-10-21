import { describe, expect, it } from "vitest";

import type { CoordinatorEventStatus } from "./coordinator-event";
import { cancelEvent, canCancel } from "./event-cancellation";
import { EventNotCancellableError } from "./errors";

describe("cancelEvent (SPM-55)", () => {
  it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Confirmed"])(
    "AC2: cancels a %s event",
    (status) => {
      expect(canCancel({ status })).toBe(true);
      expect(cancelEvent({ status })).toBe("Cancelled");
    },
  );

  it.each<CoordinatorEventStatus>(["Completed", "Cancelled"])(
    "AC2: refuses a %s event, naming its status",
    (status) => {
      expect(canCancel({ status })).toBe(false);
      expect(() => cancelEvent({ status })).toThrow(new EventNotCancellableError(status));
    },
  );
});
