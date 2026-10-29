import { describe, expect, it } from "vitest";

import { InMemoryChangeRequestRepository } from "@/adapters/outbound/in-memory/in-memory-change-request-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { changeRequestId, type ChangeRequest, type RequestedChange } from "@/core/domain/change-request";
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
      },
    },
    { [EVENT]: [pending] },
  );
  const coordinatorEvents = new InMemoryCoordinatorEventRepository([seed]);
  return { changeRequests, useCase: new DecideChangeRequestUseCase({ changeRequests, coordinatorEvents }) };
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
