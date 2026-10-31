import { describe, expect, it } from "vitest";

import { InMemoryChangeRequestRepository } from "@/adapters/outbound/in-memory/in-memory-change-request-repository";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import type { ChangeRequestTarget } from "@/core/domain/change-request";
import {
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  EventRequestNotFoundError,
  InvalidChangeRequestError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";

import { SubmitChangeRequestUseCase } from "./submit-change-request";

const OWNER = "organiser-1";
const COLLEAGUE = "organiser-2";
const REQUEST = "request-7";
const COORDINATOR = "coordinator-4";

function target(overrides: Partial<ChangeRequestTarget> = {}): ChangeRequestTarget {
  return {
    eventId: eventId("event-2"),
    status: "Confirmed",
    owningOrganiserUserAccountId: userAccountId(OWNER),
    hasOpenChangeRequest: false,
    eventName: "Marina Bay Gala",
    assignedCoordinatorUserAccountId: userAccountId(COORDINATOR),
    ...overrides,
  };
}

function build(seed: Partial<ChangeRequestTarget> | null = {}) {
  const changeRequests = new InMemoryChangeRequestRepository(seed === null ? {} : { [REQUEST]: target(seed) });
  const notifier = new RecordingNotifier();
  return { changeRequests, notifier, useCase: new SubmitChangeRequestUseCase({ changeRequests, notifier }) };
}

describe("SubmitChangeRequestUseCase (SPM-52)", () => {
  it("AC1, AC3: stores the owner's request against a Confirmed event, trimmed", async () => {
    const { changeRequests, useCase } = build();

    await useCase.execute({
      eventRequestId: REQUEST,
      userAccountId: OWNER,
      changes: [
        { field: "expected_attendance", value: 150 },
        { field: "venue_requirements", value: " Theatre seating " },
      ],
    });

    expect(changeRequests.all()).toEqual([
      {
        eventRequestId: REQUEST,
        requestedBy: OWNER,
        changes: [
          { field: "expected_attendance", value: 150 },
          { field: "venue_requirements", value: "Theatre seating" },
        ],
      },
    ]);
  });

  it("AC4: refuses a colleague who does not own the event, as not found, and stores nothing", async () => {
    const { changeRequests, useCase } = build();

    await expect(
      useCase.execute({
        eventRequestId: REQUEST,
        userAccountId: COLLEAGUE,
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow(EventRequestNotFoundError);
    expect(changeRequests.all()).toEqual([]);
  });

  it("AC4: checks ownership before the changes, so a non-owner learns nothing from a validation message", async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ eventRequestId: REQUEST, userAccountId: COLLEAGUE, changes: [] }),
    ).rejects.toThrow(EventRequestNotFoundError);
  });

  it("refuses a request that was never approved into an event, as not found", async () => {
    const { useCase } = build(null);

    await expect(
      useCase.execute({
        eventRequestId: REQUEST,
        userAccountId: OWNER,
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow(EventRequestNotFoundError);
  });

  it("refuses a Cancelled event", async () => {
    const { useCase } = build({ status: "Cancelled" });

    await expect(
      useCase.execute({
        eventRequestId: REQUEST,
        userAccountId: OWNER,
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow(ChangeRequestClosedError);
  });

  it("refuses a second request while the first is still open", async () => {
    const { changeRequests, useCase } = build();
    const command = {
      eventRequestId: REQUEST,
      userAccountId: OWNER,
      changes: [{ field: "expected_attendance", value: 150 }] as const,
    };

    await useCase.execute(command);

    await expect(useCase.execute(command)).rejects.toThrow(ChangeRequestAlreadyOpenError);
    expect(changeRequests.all()).toHaveLength(1);
  });

  it("AC1: refuses an empty request and stores nothing", async () => {
    const { changeRequests, useCase } = build();

    await expect(useCase.execute({ eventRequestId: REQUEST, userAccountId: OWNER, changes: [] })).rejects.toThrow(
      InvalidChangeRequestError,
    );
    expect(changeRequests.all()).toEqual([]);
  });
});

describe("SubmitChangeRequestUseCase notifies the coordinator (SPM-67)", () => {
  it("AC1, AC2: tells the assigned coordinator, once, every field asked for with its value", async () => {
    const { notifier, useCase } = build();

    await useCase.execute({
      eventRequestId: REQUEST,
      userAccountId: OWNER,
      changes: [
        { field: "expected_attendance", value: 150 },
        { field: "registration", value: null },
      ],
    });

    expect(notifier.changesRequested).toEqual([
      {
        recipientUserAccountId: COORDINATOR,
        eventId: "event-2",
        changeRequestId: "change-request-1",
        eventName: "Marina Bay Gala",
        changes: [
          { field: "expected_attendance", value: 150 },
          { field: "registration", value: null },
        ],
      },
    ]);
  });

  it("AC3: tells them of a request against a Confirmed event too, as there is no cut-off (#8)", async () => {
    const { notifier, useCase } = build({ status: "Confirmed" });

    await useCase.execute({
      eventRequestId: REQUEST,
      userAccountId: OWNER,
      changes: [{ field: "expected_attendance", value: 150 }],
    });

    expect(notifier.changesRequested).toHaveLength(1);
  });

  it("AC1: tells no one of a refused request", async () => {
    const { notifier, useCase } = build({ hasOpenChangeRequest: true });

    await expect(
      useCase.execute({
        eventRequestId: REQUEST,
        userAccountId: OWNER,
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow(ChangeRequestAlreadyOpenError);
    expect(notifier.changesRequested).toEqual([]);
  });

  it("AC1: tells no one of a request from someone who does not own the event", async () => {
    const { notifier, useCase } = build();

    await expect(
      useCase.execute({
        eventRequestId: REQUEST,
        userAccountId: COLLEAGUE,
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow(EventRequestNotFoundError);
    expect(notifier.changesRequested).toEqual([]);
  });

  it("stores the request before telling anyone, so a notice that fails cannot lose it", async () => {
    const changeRequests = new InMemoryChangeRequestRepository({ [REQUEST]: target() });
    const useCase = new SubmitChangeRequestUseCase({
      changeRequests,
      notifier: { changeRequested: () => Promise.reject(new Error("Novu is down")) },
    });

    await expect(
      useCase.execute({
        eventRequestId: REQUEST,
        userAccountId: OWNER,
        changes: [{ field: "expected_attendance", value: 150 }],
      }),
    ).rejects.toThrow("Novu is down");
    expect(changeRequests.all()).toHaveLength(1);
  });

  it("stores the request and tells no one when the event has no coordinator", async () => {
    const { changeRequests, notifier, useCase } = build({ assignedCoordinatorUserAccountId: null });

    await useCase.execute({
      eventRequestId: REQUEST,
      userAccountId: OWNER,
      changes: [{ field: "expected_attendance", value: 150 }],
    });

    expect(changeRequests.all()).toHaveLength(1);
    expect(notifier.changesRequested).toEqual([]);
  });
});
