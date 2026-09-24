import { describe, expect, it } from "vitest";

import {
  clarificationMessage,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClarificationThreadRepository } from "@/adapters/outbound/in-memory/in-memory-clarification-thread-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import {
  ClarificationMessageRequiredError,
  ClarificationReplyNotTopLevelError,
  ClarificationThreadClosedError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import {
  eventRequestAccessFor,
  eventRequestId,
  type EventRequest,
} from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { PostClarificationMessageUseCase } from "./post-clarification-message";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const ORGANISER = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");
const COORDINATOR = userAccountId("coordinator-1");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    status: "Returned",
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: ORGANISER,
    assignedCoordinatorUserAccountId: COORDINATOR,
    submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  const clarificationThread = new InMemoryClarificationThreadRepository();
  const eventRequests = new InMemoryEventRequestRepository(seed, clarificationThread);
  const useCase = new PostClarificationMessageUseCase({ eventRequests, clarificationThread });
  return { useCase, eventRequests, clarificationThread };
}

/** The Coordinator's question, so a reply has something to hang off. */
async function withQuestion(seed: readonly EventRequest[]) {
  const harness = buildUseCase(seed);
  const question = await harness.clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-1"),
        authorUserAccountId: COORDINATOR,
        body: "How many need step-free access?",
        parentId: null,
      }),
    );
  return { ...harness, question };
}

describe("PostClarificationMessageUseCase (SPM-33)", () => {
  it("appends the Organiser's reply to the thread (AC4)", async () => {
    const { useCase, clarificationThread, question } = await withQuestion([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: ORGANISER,
      organisationId: ORG_A,
      body: "Captions only, no interpretation.",
      parentId: question.id,
    });

    expect(result.clarificationMessageId).toBe("message-2");
    expect(clarificationThread.all()).toMatchObject([
      { body: "How many need step-free access?", parentId: null },
      {
        authorUserAccountId: ORGANISER,
        body: "Captions only, no interpretation.",
        parentId: question.id,
      },
    ]);
  });

  it("appends a new top-level message when there is nothing to reply to", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);

    await useCase.execute({
      id: "request-1",
      userAccountId: ORGANISER,
      organisationId: ORG_A,
      body: "One more thing.",
      parentId: null,
    });

    expect(clarificationThread.all()).toMatchObject([
      { body: "One more thing.", parentId: null },
    ]);
  });

  it("appends a second message and leaves the status alone (AC5, decision 3)", async () => {
    const { useCase, eventRequests, clarificationThread } = await withQuestion([request()]);

    for (const body of ["Captions only.", "Actually, also a hearing loop."]) {
      await useCase.execute({
        id: "request-1",
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body,
        parentId: null,
      });
    }

    expect(clarificationThread.all()).toHaveLength(3);
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Returned",
    });
  });

  it("does not require edit access, so a submitted request can still be answered (#102)", async () => {
    // `eventRequestAccessFor` grants "edit" only while a request is Draft, and
    // every status below is past that. Posting is not editing -- that
    // distinction is the whole reason this is an append.
    for (const status of ["Submitted", "Under Review", "Returned"] as const) {
      const { useCase, eventRequests, clarificationThread } = buildUseCase([request({ status })]);

      await useCase.execute({
        id: "request-1",
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body: "Answering.",
        parentId: null,
      });

      expect(clarificationThread.all()).toHaveLength(1);
      // Nothing about the request itself changed -- not its status, not a field.
      await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toEqual(
        request({ status }),
      );
    }
  });

  it.each(["", "   "])("refuses a blank body (%j) and writes nothing", async (body) => {
    const { useCase, clarificationThread } = buildUseCase([request()]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body,
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(ClarificationMessageRequiredError);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("answers another organisation's request as not found, writing nothing (#81, #91)", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: ORGANISER,
        organisationId: ORG_B,
        body: "Answering.",
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("refuses a colleague in the same organisation, who may read it but is not in the exchange", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: COLLEAGUE,
        organisationId: ORG_A,
        body: "Chiming in.",
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("answers an unknown id as not found, writing nothing", async () => {
    const { useCase, clarificationThread } = buildUseCase([]);

    await expect(
      useCase.execute({
        id: "missing",
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body: "Answering.",
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(clarificationThread.all()).toEqual([]);
  });

  it("refuses a reply to a reply -- threading is one level (decision 6)", async () => {
    const { useCase, clarificationThread, question } = await withQuestion([request()]);
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
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body: "Nesting further.",
        parentId: reply.id,
      }),
    ).rejects.toBeInstanceOf(ClarificationReplyNotTopLevelError);
    expect(clarificationThread.all()).toHaveLength(2);
  });

  it("refuses a parent that is not on this request at all", async () => {
    const { useCase, clarificationThread } = buildUseCase([request()]);
    const elsewhere = await clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-9"),
        authorUserAccountId: COORDINATOR,
        body: "A question on a different request.",
        parentId: null,
      }),
    );

    await expect(
      useCase.execute({
        id: "request-1",
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body: "Answering the wrong thread.",
        parentId: elsewhere.id,
      }),
    ).rejects.toBeInstanceOf(ClarificationReplyNotTopLevelError);
    expect(clarificationThread.all()).toHaveLength(1);
  });
});

/**
 * SPM-162: the check that keeps #102 honoured. Posting must never be a way for
 * the Organiser to acquire edit rights over a request they have submitted.
 */
describe("posting never makes a submitted request editable (SPM-33, #102)", () => {
  it.each(["Submitted", "Under Review", "Returned"] as const)(
    "leaves a %s request read-only for its own Organiser, before and after posting",
    async (status) => {
      const organiser = { userAccountId: ORGANISER, clientOrganisationId: ORG_A };
      const { useCase, eventRequests } = buildUseCase([request({ status })]);

      expect(eventRequestAccessFor(request({ status }), organiser)).toBe("view");

      await useCase.execute({
        id: "request-1",
        userAccountId: ORGANISER,
        organisationId: ORG_A,
        body: "Answering.",
        parentId: null,
      });

      const after = await eventRequests.findById(eventRequestId("request-1"));
      expect(after).not.toBeNull();
      expect(eventRequestAccessFor(after!, organiser)).toBe("view");
    },
  );
});

describe("PostClarificationMessageUseCase once the request is decided (SPM-33)", () => {
  it.each(["Approved", "Rejected", "Withdrawn"] as const)(
    "refuses a message on a %s request, writing nothing -- the thread is closed",
    async (status) => {
      const { useCase, clarificationThread } = buildUseCase([request({ status })]);

      await expect(
        useCase.execute({
          id: "request-1",
          userAccountId: ORGANISER,
          organisationId: ORG_A,
          body: "One more thing.",
          parentId: null,
        }),
      ).rejects.toBeInstanceOf(ClarificationThreadClosedError);
      expect(clarificationThread.all()).toEqual([]);
    },
  );
});

