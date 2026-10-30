import { describe, expect, it } from "vitest";

import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { InMemoryConfirmationLapses } from "@/adapters/outbound/in-memory/in-memory-confirmation-lapses";
import { InMemoryChangeRequestRepository } from "@/adapters/outbound/in-memory/in-memory-change-request-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import {
  changeRequestId,
  type ChangeRequest,
  type ItemDecision,
  type RequestedChange,
} from "@/core/domain/change-request";
import {
  ChangeRequestAlreadyDecidedError,
  ChangeRequestClosedError,
  ChangeRequestNotFoundError,
  InvalidChangeRequestDecisionError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { DecideChangeRequestUseCase } from "./decide-change-request";

const COORDINATOR = "coordinator-1";
const OTHER_COORDINATOR = "coordinator-2";
const EVENT = "event-1";

const times: RequestedChange = { field: "times", value: [{ date: "2026-11-21", start: "09:00", end: "12:00" }] };
const attendance: RequestedChange = { field: "expected_attendance", value: 350 };

function event(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: EVENT,
    eventRequestId: "request-1",
    name: "Annual Conference",
    clientOrganisationName: "Acme",
    preferredDate: "2026-11-20",
    status: "Confirmed",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: null,
    expectedAttendance: 300,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    times: [{ date: "2026-11-20", start: "09:00", end: "12:00" }],
    ...overrides,
  };
}

function request(...changes: RequestedChange[]): ChangeRequest {
  return {
    id: changeRequestId("4"),
    submittedAt: new Date("2026-10-27T02:00:00Z"),
    requestedBy: userAccountId("organiser-1"),
    items: changes.map((change) => ({ change, decision: "Pending", reason: null })),
  };
}

function build(seed: SeedCoordinatorEvent = event(), pending: ChangeRequest = request(times, attendance)) {
  const changeRequests = new InMemoryChangeRequestRepository(
    {
      "request-1": {
        eventId: eventId(EVENT),
        status: seed.status,
        owningOrganiserUserAccountId: userAccountId("organiser-1"),
        hasOpenChangeRequest: true,
        eventName: "Marina Bay Gala",
        assignedCoordinatorUserAccountId: userAccountId(COORDINATOR),
      },
    },
    { [EVENT]: [pending] },
  );
  const coordinatorEvents = new InMemoryCoordinatorEventRepository([seed]);
  const notifier = new RecordingNotifier();
  const lapses = new InMemoryConfirmationLapses();
  return {
    changeRequests,
    notifier,
    lapses,
    useCase: new DecideChangeRequestUseCase({ changeRequests, coordinatorEvents, lapses, notifier }),
  };
}

const stored = async (changeRequests: InMemoryChangeRequestRepository) =>
  (await changeRequests.listForEvent(userAccountId(COORDINATOR), eventId(EVENT)))[0];

describe("DecideChangeRequestUseCase (SPM-100)", () => {
  it("AC2, AC4: stores a mixed decision and reports the reschedule", async () => {
    const { changeRequests, useCase } = build();

    const outcome = await useCase.execute({
      eventId: EVENT,
      changeRequestId: "4",
      userAccountId: COORDINATOR,
      decisions: [
        { field: "times", outcome: "Accepted" },
        { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
      ],
    });

    expect((await stored(changeRequests)).items).toEqual([
      { change: times, decision: "Accepted", reason: null },
      { change: attendance, decision: "Declined", reason: "Room caps at 300" },
    ]);
    expect(outcome).toEqual({
      items: (await stored(changeRequests)).items,
      rescheduled: true,
      revalidation: { bookingFlagFields: ["times"], equipmentReview: true },
      lapsed: false,
    });
  });

  it("does not report a reschedule when the times are declined", async () => {
    const { useCase } = build();

    const outcome = await useCase.execute({
      eventId: EVENT,
      changeRequestId: "4",
      userAccountId: COORDINATOR,
      decisions: [
        { field: "times", outcome: "Declined", reason: "The hall is booked" },
        { field: "expected_attendance", outcome: "Accepted" },
      ],
    });

    expect(outcome.rescheduled).toBe(false);
    expect(outcome.revalidation).toEqual({ bookingFlagFields: ["expected_attendance"], equipmentReview: false });
  });

  it("closes the request, so the Organiser can submit another", async () => {
    const { changeRequests, useCase } = build();

    await useCase.execute({
      eventId: EVENT,
      changeRequestId: "4",
      userAccountId: COORDINATOR,
      decisions: [
        { field: "times", outcome: "Accepted" },
        { field: "expected_attendance", outcome: "Accepted" },
      ],
    });

    expect((await changeRequests.findTarget(eventRequestId("request-1")))?.hasOpenChangeRequest).toBe(false);
  });

  it("refuses a Coordinator the event is not assigned to, as not found, and stores nothing (#91)", async () => {
    const { changeRequests, useCase } = build();

    await expect(
      useCase.execute({ eventId: EVENT, changeRequestId: "4", userAccountId: OTHER_COORDINATOR, decisions: [] }),
    ).rejects.toThrow(ChangeRequestNotFoundError);
    expect((await stored(changeRequests)).items.every((item) => item.decision === "Pending")).toBe(true);
  });

  it("refuses a request id the event does not have, as not found", async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ eventId: EVENT, changeRequestId: "99", userAccountId: COORDINATOR, decisions: [] }),
    ).rejects.toThrow(ChangeRequestNotFoundError);
  });

  it("refuses a Cancelled event", async () => {
    const { useCase } = build(event({ status: "Cancelled" }));

    await expect(
      useCase.execute({ eventId: EVENT, changeRequestId: "4", userAccountId: COORDINATOR, decisions: [] }),
    ).rejects.toThrow(ChangeRequestClosedError);
  });

  it("AC3: refuses a decline with no reason, and stores nothing", async () => {
    const { changeRequests, useCase } = build();

    await expect(
      useCase.execute({
        eventId: EVENT,
        changeRequestId: "4",
        userAccountId: COORDINATOR,
        decisions: [
          { field: "times", outcome: "Accepted" },
          { field: "expected_attendance", outcome: "Declined", reason: " " },
        ],
      }),
    ).rejects.toThrow(InvalidChangeRequestDecisionError);
    expect((await stored(changeRequests)).items.every((item) => item.decision === "Pending")).toBe(true);
  });

  it("refuses to decide a request a second time", async () => {
    const { useCase } = build();
    const command = {
      eventId: EVENT,
      changeRequestId: "4",
      userAccountId: COORDINATOR,
      decisions: [
        { field: "times", outcome: "Accepted" },
        { field: "expected_attendance", outcome: "Accepted" },
      ] as const,
    };

    await useCase.execute(command);
    await expect(useCase.execute(command)).rejects.toThrow(ChangeRequestAlreadyDecidedError);
  });
});

describe("DecideChangeRequestUseCase notifies the Organiser of a reschedule (SPM-68)", () => {
  const decide = (useCase: DecideChangeRequestUseCase, decisions: readonly ItemDecision[], by = COORDINATOR) =>
    useCase.execute({ eventId: EVENT, changeRequestId: "4", userAccountId: by, decisions });

  it("AC1, AC2, AC4: an accepted change of times tells the Organiser the new times, once", async () => {
    const { useCase, notifier } = build();

    await decide(useCase, [
      { field: "times", outcome: "Accepted" },
      { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
    ]);

    expect(notifier.eventsRescheduled).toEqual([
      {
        recipientUserAccountId: "organiser-1",
        eventId: EVENT,
        eventRequestId: "request-1",
        eventName: "Annual Conference",
        times: [{ date: "2026-11-21", start: "09:00", end: "12:00" }],
        backToPlanning: false,
      },
    ]);
  });

  it("AC2: carries every accepted date and time, in date then start order", async () => {
    const several: RequestedChange = {
      field: "times",
      value: [
        { date: "2026-11-21", start: "09:00", end: "12:00" },
        { date: "2026-11-21", start: "14:00", end: "17:00" },
        { date: "2026-11-22", start: "09:00", end: "12:00" },
      ],
    };
    const { useCase, notifier } = build(event(), request(several));

    await decide(useCase, [{ field: "times", outcome: "Accepted" }]);

    expect(notifier.eventsRescheduled[0]?.times).toEqual(several.value);
  });

  it("AC1: a declined change of times sends no reschedule notice", async () => {
    const { useCase, notifier } = build();

    await decide(useCase, [
      { field: "times", outcome: "Declined", reason: "The hall is booked" },
      { field: "expected_attendance", outcome: "Accepted" },
    ]);

    expect(notifier.eventsRescheduled).toEqual([]);
  });

  it("AC1: a request that does not ask for new times sends no reschedule notice", async () => {
    const { useCase, notifier } = build(event(), request(attendance));

    await decide(useCase, [{ field: "expected_attendance", outcome: "Accepted" }]);

    expect(notifier.eventsRescheduled).toEqual([]);
  });

  it("access: a refused coordinator sends nothing", async () => {
    const { useCase, notifier } = build();

    await expect(decide(useCase, [{ field: "times", outcome: "Accepted" }], OTHER_COORDINATOR)).rejects.toThrow(
      ChangeRequestNotFoundError,
    );
    expect(notifier.eventsRescheduled).toEqual([]);
  });

  it("race: the second of two decisions is refused and sends no second notice", async () => {
    const { useCase, notifier } = build(event(), request(times));

    await decide(useCase, [{ field: "times", outcome: "Accepted" }]);
    await expect(decide(useCase, [{ field: "times", outcome: "Accepted" }])).rejects.toThrow(
      ChangeRequestAlreadyDecidedError,
    );

    expect(notifier.eventsRescheduled).toHaveLength(1);
  });
});

describe("DecideChangeRequestUseCase tells the Organiser the outcome (SPM-110)", () => {
  const venue: RequestedChange = { field: "venue_requirements", value: "Step-free access" };
  const decide = (useCase: DecideChangeRequestUseCase, decisions: readonly ItemDecision[], by = COORDINATOR) =>
    useCase.execute({ eventId: EVENT, changeRequestId: "4", userAccountId: by, decisions });

  it("AC1, AC2, AC4: a three-field mixed decision sends one notice, to the Organiser who asked", async () => {
    const asked = { ...request(times, attendance, venue), requestedBy: userAccountId("organiser-7") };
    const { useCase, notifier } = build(event(), asked);

    await decide(useCase, [
      { field: "times", outcome: "Accepted" },
      { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
      { field: "venue_requirements", outcome: "Accepted" },
    ]);

    expect(notifier.changeRequestsDecided).toEqual([
      {
        recipientUserAccountId: "organiser-7",
        eventId: EVENT,
        changeRequestId: "4",
        eventRequestId: "request-1",
        eventName: "Annual Conference",
        accepted: [times, venue],
        declined: [{ change: attendance, reason: "Room caps at 300" }],
      },
    ]);
  });

  it("AC1: tells them when every field is declined, with each reason", async () => {
    const { useCase, notifier } = build();

    await decide(useCase, [
      { field: "times", outcome: "Declined", reason: "The hall is booked" },
      { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
    ]);

    expect(notifier.changeRequestsDecided[0]).toMatchObject({
      accepted: [],
      declined: [
        { change: times, reason: "The hall is booked" },
        { change: attendance, reason: "Room caps at 300" },
      ],
    });
  });

  it("AC3: a decline with no reason is refused, so nothing is sent", async () => {
    const { useCase, notifier } = build();

    await expect(
      decide(useCase, [
        { field: "times", outcome: "Accepted" },
        { field: "expected_attendance", outcome: "Declined", reason: "  " },
      ]),
    ).rejects.toThrow(InvalidChangeRequestDecisionError);
    expect(notifier.changeRequestsDecided).toEqual([]);
  });

  it("access: a refused coordinator sends nothing", async () => {
    const { useCase, notifier } = build();

    await expect(decide(useCase, [{ field: "times", outcome: "Accepted" }], OTHER_COORDINATOR)).rejects.toThrow(
      ChangeRequestNotFoundError,
    );
    expect(notifier.changeRequestsDecided).toEqual([]);
  });

  it("race: the second of two decisions is refused and sends no second notice", async () => {
    const { useCase, notifier } = build(event(), request(times));

    await decide(useCase, [{ field: "times", outcome: "Accepted" }]);
    await expect(decide(useCase, [{ field: "times", outcome: "Accepted" }])).rejects.toThrow(
      ChangeRequestAlreadyDecidedError,
    );

    expect(notifier.changeRequestsDecided).toHaveLength(1);
  });
});

describe("DecideChangeRequestUseCase tells the Organiser of a lapse (SPM-111)", () => {
  const decide = (useCase: DecideChangeRequestUseCase, decisions: readonly ItemDecision[]) =>
    useCase.execute({ eventId: EVENT, changeRequestId: "4", userAccountId: COORDINATOR, decisions });
  const lapse = {
    eventId: eventId(EVENT),
    eventName: "Annual Conference",
    eventRequestId: "request-1",
    owningOrganiserUserAccountId: userAccountId("organiser-1"),
    lapsed: [{ kind: "flagged-booking", venueLocation: "Main Hall" }] as const,
  };

  it("AC1, AC2, AC3: an accepted attendance increase that lapses the event sends one notice naming what lapsed", async () => {
    const { useCase, notifier, lapses } = build(event(), request(attendance));
    lapses.record("change-request", "4", [lapse]);

    const outcome = await decide(useCase, [{ field: "expected_attendance", outcome: "Accepted" }]);

    expect(outcome.lapsed).toBe(true);
    expect(notifier.eventsNoLongerConfirmed).toEqual([
      {
        recipientUserAccountId: "organiser-1",
        eventId: EVENT,
        eventRequestId: "request-1",
        eventName: "Annual Conference",
        lapsed: [{ kind: "flagged-booking", venueLocation: "Main Hall" }],
      },
    ]);
  });

  it("AC4: an accepted time change that lapses the event sends no lapse notice; the reschedule says it", async () => {
    const { useCase, notifier, lapses } = build(event(), request(times));
    lapses.record("change-request", "4", [lapse]);

    await decide(useCase, [{ field: "times", outcome: "Accepted" }]);

    expect(notifier.eventsNoLongerConfirmed).toEqual([]);
    expect(notifier.eventsRescheduled.map((notice) => notice.backToPlanning)).toEqual([true]);
  });

  it("a decision that lapses nothing sends no lapse notice", async () => {
    const { useCase, notifier } = build(event(), request(attendance));

    const outcome = await decide(useCase, [
      { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
    ]);

    expect(outcome.lapsed).toBe(false);
    expect(notifier.eventsNoLongerConfirmed).toEqual([]);
  });
});
