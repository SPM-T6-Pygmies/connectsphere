import { describe, expect, it } from "vitest";

import { InMemoryChangeRequestRepository } from "@/adapters/outbound/in-memory/in-memory-change-request-repository";
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

function target(overrides: Partial<ChangeRequestTarget> = {}): ChangeRequestTarget {
  return {
    eventId: eventId("event-2"),
    status: "Confirmed",
    owningOrganiserUserAccountId: userAccountId(OWNER),
    hasOpenChangeRequest: false,
    ...overrides,
  };
}

function build(seed: Partial<ChangeRequestTarget> | null = {}) {
  const changeRequests = new InMemoryChangeRequestRepository(seed === null ? {} : { [REQUEST]: target(seed) });
  return { changeRequests, useCase: new SubmitChangeRequestUseCase({ changeRequests }) };
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
