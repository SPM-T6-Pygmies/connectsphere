import { describe, expect, it } from "vitest";

import type { CoordinatorEvent, CoordinatorEventStatus } from "./coordinator-event";
import { eventId } from "./event";
import { EventNotConfirmableError, EventNotReadyForConfirmationError } from "./errors";
import {
  blockingArrangements,
  canConfirm,
  confirmEvent,
  type ArrangementReadiness,
  type EventReadiness,
} from "./event-readiness";
import { userAccountId } from "./user-account";

const EVENT_ID = eventId("event-1");
const COORDINATOR = userAccountId("coordinator-1");

function event(overrides: Partial<CoordinatorEvent> = {}): CoordinatorEvent {
  return {
    id: EVENT_ID,
    name: "Founders' Day",
    status: "Planning",
    assignedCoordinatorUserAccountId: COORDINATOR,
    ...overrides,
  };
}

function readiness(essentialArrangements: readonly ArrangementReadiness[]): EventReadiness {
  return { eventId: EVENT_ID, essentialArrangements };
}

describe("blockingArrangements", () => {
  it("is empty when every essential arrangement is complete", () => {
    expect(
      blockingArrangements(
        readiness([
          { type: "venue", complete: true },
          { type: "programme", complete: true },
        ]),
      ),
    ).toEqual([]);
  });

  it("names a single incomplete essential arrangement", () => {
    expect(
      blockingArrangements(
        readiness([
          { type: "venue", complete: true },
          { type: "programme", complete: false },
        ]),
      ),
    ).toEqual(["programme"]);
  });

  it("names every incomplete essential arrangement", () => {
    expect(
      blockingArrangements(
        readiness([
          { type: "venue", complete: false },
          { type: "programme", complete: false },
          { type: "registration", complete: true },
        ]),
      ),
    ).toEqual(["venue", "programme"]);
  });

  it("is empty when there are no essential arrangements at all", () => {
    expect(blockingArrangements(readiness([]))).toEqual([]);
  });
});

describe("canConfirm", () => {
  it("is true in Planning with nothing blocking", () => {
    expect(canConfirm(event({ status: "Planning" }), readiness([{ type: "venue", complete: true }]))).toBe(
      true,
    );
  });

  it("is false in Planning with something still incomplete", () => {
    expect(
      canConfirm(event({ status: "Planning" }), readiness([{ type: "venue", complete: false }])),
    ).toBe(false);
  });

  it.each(["Blocked", "Confirmed", "Completed", "Cancelled"] as CoordinatorEventStatus[])(
    "is false when status is %s, even with nothing blocking",
    (status) => {
      expect(canConfirm(event({ status }), readiness([]))).toBe(false);
    },
  );
});

describe("confirmEvent", () => {
  it("confirms a Planning event with every essential arrangement complete", () => {
    const confirmed = confirmEvent(
      event({ status: "Planning" }),
      readiness([
        { type: "venue", complete: true },
        { type: "programme", complete: true },
      ]),
    );

    expect(confirmed.status).toBe("Confirmed");
  });

  it("confirms even while a non-essential arrangement is incomplete, since only essential rows are ever in readiness", () => {
    const confirmed = confirmEvent(
      event({ status: "Planning" }),
      readiness([{ type: "venue", complete: true }]),
    );

    expect(confirmed.status).toBe("Confirmed");
  });

  it("refuses with the exact blocking list when an essential arrangement is incomplete", () => {
    expect(() =>
      confirmEvent(
        event({ status: "Planning" }),
        readiness([
          { type: "venue", complete: false },
          { type: "registration", complete: false },
        ]),
      ),
    ).toThrow(EventNotReadyForConfirmationError);

    try {
      confirmEvent(
        event({ status: "Planning" }),
        readiness([
          { type: "venue", complete: false },
          { type: "registration", complete: false },
        ]),
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EventNotReadyForConfirmationError);
      expect((error as EventNotReadyForConfirmationError).blockingArrangements).toEqual([
        "venue",
        "registration",
      ]);
    }
  });

  it.each(["Blocked", "Confirmed", "Completed", "Cancelled"] as CoordinatorEventStatus[])(
    "refuses to confirm an event with status %s",
    (status) => {
      expect(() => confirmEvent(event({ status }), readiness([]))).toThrow(EventNotConfirmableError);
    },
  );
});
