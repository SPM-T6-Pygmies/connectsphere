import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClarificationThreadRepository } from "@/adapters/outbound/in-memory/in-memory-clarification-thread-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import {
  ClarificationMessageRequiredError,
  EventRequestNotFoundError,
  EventRequestNotReturnableError,
} from "@/core/domain/errors";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { RequestClarificationUseCase } from "./request-clarification";

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
  // The two in-memory stores are wired together the way the real ones are: a
  // return writes the status and the question as one act, so the thread store
  // is the event-request store's, not a second dependency of the use case.
  const clarificationThread = new InMemoryClarificationThreadRepository();
  const eventRequests = new InMemoryEventRequestRepository(seed, clarificationThread);
  const useCase = new RequestClarificationUseCase({ eventRequests });
  return { useCase, eventRequests, clarificationThread };
}

describe("RequestClarificationUseCase (SPM-33)", () => {
  it("returns the request to the Organiser and keeps the question with the record (AC1, AC2, AC4)", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      message: "How many need step-free access?",
    });

    expect(result).toEqual({ eventRequestId: "request-1", status: "Returned" });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Returned",
    });
    expect(clarificationThread.all()).toMatchObject([
      {
        eventRequestId: "request-1",
        authorUserAccountId: COORDINATOR,
        body: "How many need step-free access?",
        parentId: null,
        // What a return opens is a question, not a remark: this is the flag
        // that holds the request with the Organiser until it is resolved.
        isClarificationRequest: true,
        resolvedAt: null,
      },
    ]);
  });

  it("stores the question trimmed, and opens the exchange top-level", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);

    await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      message: "  Which rooms?  ",
    });

    expect(clarificationThread.all()[0]).toMatchObject({ body: "Which rooms?", parentId: null });
  });

  it("returns an already-Returned request again, appending a second question (decision 5)", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([
      request({ status: "Returned" }),
    ]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      message: "And the catering headcount?",
    });

    expect(result.status).toBe("Returned");
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Returned",
    });
    expect(clarificationThread.all()).toHaveLength(1);
  });

  it("leaves two questions outstanding when returned twice, so neither resolve is the last", async () => {
    // Paired with ResolveClarificationThreadUseCase: two returns means two
    // open questions, and only clearing both resumes the request.
    const { useCase, clarificationThread } = buildUseCase([request()]);

    for (const message of ["Stage access for rehearsals?", "Headcount per day or total?"]) {
      await useCase.execute({ id: "request-1", userAccountId: COORDINATOR, message });
    }

    expect(
      clarificationThread.all().filter((m) => m.isClarificationRequest && m.resolvedAt === null),
    ).toHaveLength(2);
  });

  it.each(["", "   "])(
    "refuses a blank message (%j) and writes to neither repository (AC3)",
    async (message) => {
      const existing = request();
      const { useCase, eventRequests, clarificationThread } = buildUseCase([existing]);

      await expect(
        useCase.execute({ id: "request-1", userAccountId: COORDINATOR, message }),
      ).rejects.toBeInstanceOf(ClarificationMessageRequiredError);
      expect(eventRequests.all()).toEqual([existing]);
      expect(clarificationThread.all()).toEqual([]);
    },
  );

  it("answers an unknown id as not found, writing nothing", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([]);

    await expect(
      useCase.execute({ id: "missing", userAccountId: COORDINATOR, message: "Why?" }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(eventRequests.all()).toEqual([]);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("answers another coordinator's request as not found, not as forbidden (AC7, #91)", async () => {
    const existing = request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR });
    const { useCase, eventRequests, clarificationThread } = buildUseCase([existing]);

    await expect(
      useCase.execute({ id: "request-1", userAccountId: COORDINATOR, message: "Why?" }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(eventRequests.all()).toEqual([existing]);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("refuses to return an Approved request and writes to neither repository", async () => {
    const existing = request({ status: "Approved", decisionRecord: "Enough to plan." });
    const { useCase, eventRequests, clarificationThread } = buildUseCase([existing]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        message: "Actually, one more thing.",
      }),
    ).rejects.toBeInstanceOf(EventRequestNotReturnableError);
    expect(eventRequests.all()).toEqual([existing]);
    expect(clarificationThread.all()).toEqual([]);
  });
});
