import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import {
  DecisionReasonRequiredError,
  EventRequestNotDecidableError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { DecideEventRequestUseCase } from "./decide-event-request";

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
  const useCase = new DecideEventRequestUseCase({ eventRequests });
  return { useCase, eventRequests };
}

describe("DecideEventRequestUseCase (SPM-139)", () => {
  it("approves a request awaiting the assigned coordinator's decision (AC1)", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      decision: "approve",
      decisionRecord: "Enough to plan.",
    });

    expect(result).toEqual({ eventRequestId: "request-1", status: "Approved" });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Approved",
      decisionRecord: "Enough to plan.",
    });
  });

  it("rejects a request, keeping the coordinator's reason as its decision record (AC2)", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      decision: "reject",
      decisionRecord: "No expected attendance.",
    });

    expect(result).toEqual({ eventRequestId: "request-1", status: "Rejected" });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Rejected",
      decisionRecord: "No expected attendance.",
    });
  });

  it("refuses a rejection without a reason and stores nothing", async () => {
    const existing = request();
    const { useCase, eventRequests } = buildUseCase([existing]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        decision: "reject",
        decisionRecord: "   ",
      }),
    ).rejects.toBeInstanceOf(DecisionReasonRequiredError);
    expect(eventRequests.all()).toEqual([existing]);
  });

  it.each([
    ["assigned to another coordinator", request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })],
    ["not assigned to anyone", request({ assignedCoordinatorUserAccountId: null })],
  ])("answers a request %s as not found, and stores nothing (#91)", async (_label, existing) => {
    const { useCase, eventRequests } = buildUseCase([existing]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        decision: "approve",
        decisionRecord: "",
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(eventRequests.all()).toEqual([existing]);
  });

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({
        id: "missing",
        userAccountId: COORDINATOR,
        decision: "approve",
        decisionRecord: "",
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });

  // `Returned` used to sit in this matrix. SPM-33 decision 4 widened
  // `assertDecidable` to admit it, and the positive cases live in their own
  // (SPM-33) block below -- the rule is that ticket's, not this one's.
  it.each(["Approved", "Rejected"] as const)(
    "refuses to decide a %s request and stores nothing",
    async (status) => {
      const existing = request({ status, decisionRecord: "Earlier decision." });
      const { useCase, eventRequests } = buildUseCase([existing]);

      await expect(
        useCase.execute({
          id: "request-1",
          userAccountId: COORDINATOR,
          decision: "reject",
          decisionRecord: "Changed my mind.",
        }),
      ).rejects.toBeInstanceOf(EventRequestNotDecidableError);
      expect(eventRequests.all()).toEqual([existing]);
    },
  );
});

/**
 * SPM-33 decision 4, not SPM-139's rule: a `Returned` request can be approved
 * or rejected directly, without the Coordinator first marking the
 * clarification resolved. Resolve is the "I am no longer waiting" signal, not
 * a gate in front of deciding.
 */
describe("DecideEventRequestUseCase on a returned request (SPM-33)", () => {
  it("approves a Returned request without resolving the clarification first", async () => {
    const { useCase, eventRequests } = buildUseCase([request({ status: "Returned" })]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      decision: "approve",
      decisionRecord: "Answered in the thread.",
    });

    expect(result).toEqual({ eventRequestId: "request-1", status: "Approved" });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Approved",
      decisionRecord: "Answered in the thread.",
    });
  });

  it("rejects a Returned request directly, keeping the reason", async () => {
    const { useCase, eventRequests } = buildUseCase([request({ status: "Returned" })]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      decision: "reject",
      decisionRecord: "No answer and the date has passed.",
    });

    expect(result.status).toBe("Rejected");
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      decisionRecord: "No answer and the date has passed.",
    });
  });

  it("still refuses another coordinator's returned request as not found (#91)", async () => {
    const existing = request({
      status: "Returned",
      assignedCoordinatorUserAccountId: OTHER_COORDINATOR,
    });
    const { useCase, eventRequests } = buildUseCase([existing]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        decision: "approve",
        decisionRecord: "",
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(eventRequests.all()).toEqual([existing]);
  });
});
