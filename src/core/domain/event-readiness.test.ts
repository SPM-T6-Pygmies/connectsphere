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
  assessReadiness,
  blockingArrangements,
  canConfirm,
  confirmationState,
  confirmEvent,
  type ArrangementReadiness,
  type EventReadiness,
  type ReadinessFacts,
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
    statedEquipmentNeeds: null,
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

function facts(overrides: Partial<ReadinessFacts> = {}): ReadinessFacts {
  return {
    eventId: EVENT_ID,
    essentialTypes: [],
    confirmedVenueLocation: null,
    programmeAgenda: null,
    registrationEnabled: false,
    registrationOpenDate: null,
    registrationCloseDate: null,
    ...overrides,
  };
}

function only(readiness: EventReadiness): ArrangementReadiness {
  expect(readiness.essentialArrangements).toHaveLength(1);
  return readiness.essentialArrangements[0];
}

describe("assessReadiness (SPM-50)", () => {
  describe("venue", () => {
    it("is complete with a confirmed booking, and says where", () => {
      expect(
        only(assessReadiness(facts({ essentialTypes: ["venue"], confirmedVenueLocation: "Main Hall" }))),
      ).toEqual({ type: "venue", complete: true, detail: "Confirmed at Main Hall." });
    });

    it("is incomplete with no confirmed booking", () => {
      expect(only(assessReadiness(facts({ essentialTypes: ["venue"] })))).toEqual({
        type: "venue",
        complete: false,
        detail: "No confirmed venue booking yet.",
      });
    });
  });

  describe("programme", () => {
    it.each([
      ["missing", null],
      ["empty", ""],
      ["only whitespace", "  \n\t "],
    ])("is incomplete when the agenda is %s", (_label, programmeAgenda) => {
      expect(only(assessReadiness(facts({ essentialTypes: ["programme"], programmeAgenda })))).toEqual({
        type: "programme",
        complete: false,
        detail: "No agenda has been written yet.",
      });
    });

    it("is complete with an agenda, quoting it", () => {
      expect(
        only(assessReadiness(facts({ essentialTypes: ["programme"], programmeAgenda: "Talks, then lunch" }))),
      ).toEqual({ type: "programme", complete: true, detail: "Talks, then lunch" });
    });

    it("quotes an agenda of exactly 80 characters whole", () => {
      const agenda = "a".repeat(80);
      expect(
        only(assessReadiness(facts({ essentialTypes: ["programme"], programmeAgenda: agenda }))).detail,
      ).toBe(agenda);
    });

    it("cuts an agenda of 81 characters to 80 and marks the cut", () => {
      expect(
        only(assessReadiness(facts({ essentialTypes: ["programme"], programmeAgenda: "a".repeat(81) })))
          .detail,
      ).toBe(`${"a".repeat(80)}…`);
    });
  });

  describe("registration", () => {
    it("is incomplete when registration is not enabled, even with dates", () => {
      expect(
        only(
          assessReadiness(
            facts({
              essentialTypes: ["registration"],
              registrationOpenDate: "2026-10-01",
              registrationCloseDate: "2026-10-10",
            }),
          ),
        ),
      ).toEqual({
        type: "registration",
        complete: false,
        detail: "Registration is not enabled for this event.",
      });
    });

    it.each([
      ["the open date", { registrationOpenDate: null, registrationCloseDate: "2026-10-10" }],
      ["the close date", { registrationOpenDate: "2026-10-01", registrationCloseDate: null }],
    ])("is incomplete when enabled without %s", (_label, dates) => {
      expect(
        only(assessReadiness(facts({ essentialTypes: ["registration"], registrationEnabled: true, ...dates }))),
      ).toEqual({
        type: "registration",
        complete: false,
        detail: "Registration is enabled, but the open/close dates are not set yet.",
      });
    });

    it("is complete when enabled with both dates, giving the window", () => {
      expect(
        only(
          assessReadiness(
            facts({
              essentialTypes: ["registration"],
              registrationEnabled: true,
              registrationOpenDate: "2026-10-01",
              registrationCloseDate: "2026-10-10",
            }),
          ),
        ),
      ).toEqual({ type: "registration", complete: true, detail: "Open 2026-10-01 to 2026-10-10." });
    });
  });

  describe("scope", () => {
    it.each(["equipment", "technical_support", "other"] as const)(
      "leaves out %s, which has no completeness signal yet",
      (type) => {
        expect(assessReadiness(facts({ essentialTypes: [type] })).essentialArrangements).toEqual([]);
      },
    );

    it("assesses only the arrangements marked essential", () => {
      const readiness = assessReadiness(
        facts({ essentialTypes: ["programme"], confirmedVenueLocation: "Main Hall" }),
      );
      expect(readiness.essentialArrangements.map(({ type }) => type)).toEqual(["programme"]);
    });

    it("lists venue, programme, registration in that order", () => {
      const readiness = assessReadiness(
        facts({ essentialTypes: ["registration", "venue", "programme"] }),
      );
      expect(readiness.essentialArrangements.map(({ type }) => type)).toEqual([
        "venue",
        "programme",
        "registration",
      ]);
    });

    it("is vacuously ready with nothing essential", () => {
      expect(blockingArrangements(assessReadiness(facts()))).toEqual([]);
    });
  });
});

describe("blockingArrangements (SPM-50)", () => {
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

describe("canConfirm (SPM-50)", () => {
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

describe("confirmationState (SPM-50)", () => {
  it("is ready in Planning with nothing blocking", () => {
    expect(confirmationState(event({ status: "Planning" }), readiness([]))).toBe("ready");
  });

  it("is blocked by arrangements in Planning with something incomplete", () => {
    expect(
      confirmationState(
        event({ status: "Planning" }),
        readiness([{ type: "venue", complete: false, detail: "" }]),
      ),
    ).toBe("blocked-by-arrangements");
  });

  it.each(["Confirmed", "Completed"] as CoordinatorEventStatus[])(
    "is already confirmed when %s",
    (status) => {
      expect(confirmationState(event({ status }), readiness([]))).toBe("already-confirmed");
    },
  );

  it.each(["Blocked", "Cancelled"] as CoordinatorEventStatus[])(
    "is not in planning when %s, even with an incomplete arrangement",
    (status) => {
      expect(
        confirmationState(
          event({ status }),
          readiness([{ type: "venue", complete: false, detail: "" }]),
        ),
      ).toBe("not-in-planning");
    },
  );
});

describe("confirmEvent (SPM-50)", () => {
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
