import { describe, expect, it } from "vitest";

import {
  clarificationMessage,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClarificationThreadRepository } from "@/adapters/outbound/in-memory/in-memory-clarification-thread-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import {
  ClarificationThreadNotResolvableError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ResolveClarificationThreadUseCase } from "./resolve-clarification-thread";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");
const ORGANISER = userAccountId("organiser-1");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    status: "Returned",
    assignedCoordinatorUserAccountId: COORDINATOR,
    submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  const clarificationThread = new InMemoryClarificationThreadRepository();
  const eventRequests = new InMemoryEventRequestRepository(seed, clarificationThread);
  const useCase = new ResolveClarificationThreadUseCase({ eventRequests, clarificationThread });
  return { useCase, eventRequests, clarificationThread };
}

/** A question, as `returnEventRequest` would have opened it. */
function ask(thread: InMemoryClarificationThreadRepository, body: string) {
  return thread.append(
    clarificationMessage({ body, isClarificationRequest: true, authorUserAccountId: COORDINATOR }),
  );
}

async function statusOf(eventRequests: InMemoryEventRequestRepository) {
  return (await eventRequests.findById(eventRequestId("request-1")))?.status;
}

describe("ResolveClarificationThreadUseCase (SPM-33)", () => {
  it("marks the question answered and resumes the request when it was the only one (AC6)", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);
    const question = await ask(clarificationThread, "Stage access for rehearsals?");

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      clarificationMessageId: question.id,
    });

    expect(result).toEqual({
      eventRequestId: "request-1",
      status: "Under Review",
      resumed: true,
    });
    await expect(statusOf(eventRequests)).resolves.toBe("Under Review");
    expect(clarificationThread.all()[0]?.resolvedAt).not.toBeNull();
  });

  it("leaves the request with the organiser while another question is still open", async () => {
    // The whole reason resolving is per question: answering one of two is not
    // the same as no longer waiting.
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);
    const first = await ask(clarificationThread, "Stage access for rehearsals?");
    await ask(clarificationThread, "Headcount per day or total?");

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      clarificationMessageId: first.id,
    });

    expect(result).toMatchObject({ status: "Returned", resumed: false });
    await expect(statusOf(eventRequests)).resolves.toBe("Returned");
  });

  it("resumes on the second resolve, once nothing is left open", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);
    const first = await ask(clarificationThread, "Stage access for rehearsals?");
    const second = await ask(clarificationThread, "Headcount per day or total?");

    for (const question of [first, second]) {
      await useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        clarificationMessageId: question.id,
      });
    }

    await expect(statusOf(eventRequests)).resolves.toBe("Under Review");
    expect(clarificationThread.all().every((message) => message.resolvedAt !== null)).toBe(true);
  });

  it("ignores replies and plain comments when deciding whether anything is left open", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);
    const question = await ask(clarificationThread, "Stage access for rehearsals?");
    await clarificationThread.append(
      clarificationMessage({
        body: "Only on the day.",
        authorUserAccountId: ORGANISER,
        parentId: question.id,
      }),
    );
    await clarificationThread.append(clarificationMessage({ body: "Noting for the venue team." }));

    await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      clarificationMessageId: question.id,
    });

    await expect(statusOf(eventRequests)).resolves.toBe("Under Review");
  });

  it("refuses to resolve an ordinary comment, and writes nothing", async () => {
    const { useCase, eventRequests, clarificationThread } = buildUseCase([request()]);
    const comment = await clarificationThread.append(
      clarificationMessage({ body: "Noting for the venue team." }),
    );

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        clarificationMessageId: comment.id,
      }),
    ).rejects.toBeInstanceOf(ClarificationThreadNotResolvableError);
    expect(clarificationThread.all()[0]?.resolvedAt).toBeNull();
    await expect(statusOf(eventRequests)).resolves.toBe("Returned");
  });

  it("refuses to resolve the same question twice", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);
    const question = await ask(clarificationThread, "Stage access for rehearsals?");
    const command = {
      id: "request-1",
      userAccountId: COORDINATOR,
      clarificationMessageId: question.id,
    };

    await useCase.execute(command);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      ClarificationThreadNotResolvableError,
    );
  });

  it("leaves an Under Review request where it is -- there was no wait to end", async () => {
    // A question can be resolved on a request that was already resumed, e.g.
    // after a second return was itself resolved first.
    const { useCase, eventRequests, clarificationThread } = buildUseCase([
      request({ status: "Under Review" }),
    ]);
    const question = await ask(clarificationThread, "Stage access for rehearsals?");

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COORDINATOR,
      clarificationMessageId: question.id,
    });

    expect(result).toMatchObject({ status: "Under Review", resumed: false });
    await expect(statusOf(eventRequests)).resolves.toBe("Under Review");
  });

  it("answers another coordinator's request as not found, writing nothing (AC7, #91)", async () => {
    const { useCase, clarificationThread } = buildUseCase([
      request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR }),
    ]);
    const question = await ask(clarificationThread, "Stage access for rehearsals?");

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COORDINATOR,
        clarificationMessageId: question.id,
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(clarificationThread.all()[0]?.resolvedAt).toBeNull();
  });

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({
        id: "missing",
        userAccountId: COORDINATOR,
        clarificationMessageId: "message-1",
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });
});
