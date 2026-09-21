import { describe, expect, it } from "vitest";

import { clientOrganisationId } from "./client-organisation";
import type {
  CoordinatorEvent,
  CoordinatorEventStatus,
} from "./coordinator-event";
import { eventId } from "./event";
import {
  EventNotConfirmableError,
  EventNotReadyForConfirmationError,
} from "./errors";
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
    description: null,
    status: "Planning",
    preferredDate: null,
    expectedAttendance: null,
    clientOrganisationId: clientOrganisationId("org-1"),
    owningOrganiserUserAccountId: userAccountId("organiser-1"),
    assignedCoordinatorUserAccountId: COORDINATOR,
    ...overrides,
  };
}

function readiness(
  essentialArrangements: readonly ArrangementReadiness[],
): EventReadiness {
  return { eventId: EVENT_ID, essentialArrangements };
}

describe("blockingArrangements", () => {
  it("is empty when every essential arrangement is complete", () => {
    expect(
      blockingArrangements(
        readiness([
          { type: "venue", complete: true, detail: "" },
          { type: "programme", complete: true, detail: "" },
        ]),
      ),
    ).toEqual([]);
  });

  it("names a single incomplete essential arrangement", () => {
    expect(
      blockingArrangements(
        readiness([
          { type: "venue", complete: true, detail: "" },
          { type: "programme", complete: false, detail: "" },
        ]),
      ),
    ).toEqual(["programme"]);
  });

  it("names every incomplete essential arrangement", () => {
    expect(
      blockingArrangements(
        readiness([
          { type: "venue", complete: false, detail: "" },
          { type: "programme", complete: false, detail: "" },
          { type: "registration", complete: true, detail: "" },
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
    expect(
      canConfirm(
        event({ status: "Planning" }),
        readiness([{ type: "venue", complete: true, detail: "" }]),
      ),
    ).toBe(true);
  });

  it("is false in Planning with something still incomplete", () => {
    expect(
      canConfirm(
        event({ status: "Planning" }),
        readiness([{ type: "venue", complete: false, detail: "" }]),
      ),
    ).toBe(false);
  });

  it.each([
    "Blocked",
    "Confirmed",
    "Completed",
    "Cancelled",
  ] as CoordinatorEventStatus[])(
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
        { type: "venue", complete: true, detail: "" },
        { type: "programme", complete: true, detail: "" },
      ]),
    );

    expect(confirmed.status).toBe("Confirmed");
  });

  it("confirms even while a non-essential arrangement is incomplete, since only essential rows are ever in readiness", () => {
    const confirmed = confirmEvent(
      event({ status: "Planning" }),
      readiness([{ type: "venue", complete: true, detail: "" }]),
    );

    expect(confirmed.status).toBe("Confirmed");
  });

  it("refuses with the exact blocking list when an essential arrangement is incomplete", () => {
    expect(() =>
      confirmEvent(
        event({ status: "Planning" }),
        readiness([
          { type: "venue", complete: false, detail: "" },
          { type: "registration", complete: false, detail: "" },
        ]),
      ),
    ).toThrow(EventNotReadyForConfirmationError);

    try {
      confirmEvent(
        event({ status: "Planning" }),
        readiness([
          { type: "venue", complete: false, detail: "" },
          { type: "registration", complete: false, detail: "" },
        ]),
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EventNotReadyForConfirmationError);
      expect(
        (error as EventNotReadyForConfirmationError).blockingArrangements,
      ).toEqual(["venue", "registration"]);
    }
  });

  it.each([
    "Blocked",
    "Confirmed",
    "Completed",
    "Cancelled",
  ] as CoordinatorEventStatus[])(
    "refuses to confirm an event with status %s",
    (status) => {
      expect(() => confirmEvent(event({ status }), readiness([]))).toThrow(
        EventNotConfirmableError,
      );
    },
  );
});
