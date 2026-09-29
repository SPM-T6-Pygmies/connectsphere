import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import {
  EventRequestNotFoundError,
  EventRequestNotWithdrawableError,
} from "@/core/domain/errors";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { WithdrawEventRequestUseCase } from "./withdraw-event-request";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    status: "Under Review",
    assignedCoordinatorUserAccountId: COORDINATOR,
    submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  const eventRequests = new InMemoryEventRequestRepository(seed);
  const useCase = new WithdrawEventRequestUseCase({ eventRequests });
  return { useCase, eventRequests };
}

describe("WithdrawEventRequestUseCase (SPM-167)", () => {
  it("withdraws a request under review, keeping the coordinator's note", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      note: "Organiser called to withdraw.",
    });

    expect(result).toEqual({ eventRequestId: "request-1", status: "Withdrawn" });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Withdrawn",
      decisionRecord: "Organiser called to withdraw.",
    });
  });

  it("withdraws without a note -- the note is optional", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    await useCase.execute({ id: "request-1", userAccountId: COORDINATOR, note: "  " });

    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Withdrawn",
      decisionRecord: null,
    });
  });

  it.each([
    ["assigned to another coordinator", request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })],
    ["not assigned to anyone", request({ assignedCoordinatorUserAccountId: null })],
  ])("answers a request %s as not found, and stores nothing (#91)", async (_label, existing) => {
    const { useCase, eventRequests } = buildUseCase([existing]);

    await expect(
      useCase.execute({ id: "request-1", userAccountId: COORDINATOR, note: "" }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(eventRequests.all()).toEqual([existing]);
  });

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({ id: "missing", userAccountId: COORDINATOR, note: "" }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });

  it("refuses to withdraw a request already decided, and stores nothing", async () => {
    const existing = request({ status: "Rejected", decisionRecord: "Earlier decision." });
    const { useCase, eventRequests } = buildUseCase([existing]);

    await expect(
      useCase.execute({ id: "request-1", userAccountId: COORDINATOR, note: "" }),
    ).rejects.toBeInstanceOf(EventRequestNotWithdrawableError);
    expect(eventRequests.all()).toEqual([existing]);
  });
});
