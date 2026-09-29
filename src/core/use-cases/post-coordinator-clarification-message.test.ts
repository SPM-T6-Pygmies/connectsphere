import { describe, expect, it } from "vitest";

import {
  clarificationMessage,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClarificationThreadRepository } from "@/adapters/outbound/in-memory/in-memory-clarification-thread-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import {
  ClarificationMessageRequiredError,
  ClarificationThreadClosedError,
  ClarificationReplyNotTopLevelError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { PostCoordinatorClarificationMessageUseCase } from "./post-coordinator-clarification-message";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");
const ORGANISER = userAccountId("organiser-1");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    status: "Returned",
    responsibleOrganiserId: ORGANISER,
    assignedCoordinatorUserAccountId: COORDINATOR,
    submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  const clarificationThread = new InMemoryClarificationThreadRepository();
  const eventRequests = new InMemoryEventRequestRepository(seed, clarificationThread);
  const useCase = new PostCoordinatorClarificationMessageUseCase({
    eventRequests,
    clarificationThread,
  });
  return { useCase, eventRequests, clarificationThread };
}

describe("PostCoordinatorClarificationMessageUseCase (SPM-33)", () => {
  it("follows up on the thread without returning the request again (AC5)", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);

    await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      body: "Thanks -- one more thing.",
      parentId: null,
    });

    expect(clarificationThread.all()).toMatchObject([{ authorUserAccountId: COORDINATOR }]);
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Returned",
    });
  });

  it("says something more on a resolved request without dragging it back out of the queue", async () => {
    // The whole reason this use case exists rather than reusing
    // RequestClarification: a follow-up is not a new return (decision 3).
    const { useCase, eventRequests } = buildUseCase([request({ status: "Under Review" })]);

    await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      body: "Noted, thanks.",
      parentId: null,
    });

    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Under Review",
    });
  });

  it.each(["", "   "])("refuses a blank body (%j) and writes nothing", async (body) => {
    const { useCase, clarificationThread } = buildUseCase([request()]);

    await expect(
      useCase.execute({ id: "request-1", userAccountId: COORDINATOR, body, parentId: null }),
    ).rejects.toBeInstanceOf(ClarificationMessageRequiredError);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("answers another coordinator's request as not found, writing nothing (#91)", async () => {
    const { useCase, clarificationThread } = buildUseCase([
      request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR }),
    ]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        body: "Chiming in.",
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({ id: "missing", userAccountId: COORDINATOR, body: "Hi", parentId: null }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });

  it("refuses a reply to a reply -- threading is one level for both sides (decision 6)", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);
    const question = await clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-1"),
        authorUserAccountId: COORDINATOR,
        body: "How many need step-free access?",
        parentId: null,
      }),
    );
    const reply = await clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-1"),
        authorUserAccountId: ORGANISER,
        body: "Captions only.",
        parentId: question.id,
      }),
    );

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        body: "Nesting further.",
        parentId: reply.id,
      }),
    ).rejects.toBeInstanceOf(ClarificationReplyNotTopLevelError);
    expect(clarificationThread.all()).toHaveLength(2);
  });
});

describe("PostCoordinatorClarificationMessageUseCase once the request is decided (SPM-33)", () => {
  it.each(["Approved", "Rejected", "Withdrawn"] as const)(
    "refuses a message on a %s request, writing nothing -- the thread is closed",
    async (status) => {
      const { useCase, clarificationThread } = buildUseCase([request({ status })]);

      await expect(
        useCase.execute({
          id: "request-1",
          userAccountId: COORDINATOR,
          body: "Following up.",
          parentId: null,
        }),
      ).rejects.toBeInstanceOf(ClarificationThreadClosedError);
      expect(clarificationThread.all()).toEqual([]);
    },
  );
});

