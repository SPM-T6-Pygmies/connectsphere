import { describe, expect, it } from "vitest";

import {
  clarificationMessage,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClarificationThreadRepository } from "@/adapters/outbound/in-memory/in-memory-clarification-thread-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { InMemoryUserAccountRepository } from "@/adapters/outbound/in-memory/in-memory-user-account-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewOrganiserEventRequestUseCase } from "./view-organiser-event-request";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const RESPONSIBLE = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");
const COORDINATOR = userAccountId("coordinator-1");
const NAMES = new Map([
  [RESPONSIBLE, "Priya Nair"],
  [COORDINATOR, "Nadia Rahman"],
]);

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: RESPONSIBLE,
    ...overrides,
  });
}

function buildHarness(seed: readonly EventRequest[]) {
  const clarificationThread = new InMemoryClarificationThreadRepository();
  const useCase = new ViewOrganiserEventRequestUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed, clarificationThread),
    clarificationThread,
    userAccounts: new InMemoryUserAccountRepository({ names: NAMES }),
  });
  return { useCase, clarificationThread };
}

function buildUseCase(seed: readonly EventRequest[]) {
  return buildHarness(seed).useCase;
}

describe("ViewOrganiserEventRequestUseCase (SPM-112)", () => {
  it("returns the request to its own responsible Organiser", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result?.eventRequest.id).toBe(eventRequestId("request-1"));
  });

  it("returns the request to a colleague in the same client organisation", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COLLEAGUE,
      clientOrganisationId: ORG_A,
    });

    expect(result?.eventRequest.id).toBe(eventRequestId("request-1"));
  });

  it("returns null for a request belonging to an unrelated client organisation", async () => {
    const useCase = buildUseCase([request({ clientOrganisationId: ORG_B })]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: COLLEAGUE,
      clientOrganisationId: ORG_A,
    });

    expect(result).toBeNull();
  });

  it("returns null for an id that does not exist", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result).toBeNull();
  });
});

describe("ViewOrganiserEventRequestUseCase clarification thread (SPM-33)", () => {
  it("returns the exchange with its authors named, oldest first (AC4)", async () => {
    const { useCase, clarificationThread } = buildHarness([request({ status: "Returned" })]);
    const question = await clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-1"),
        authorUserAccountId: COORDINATOR,
        body: "How many need step-free access?",
        parentId: null,
      }),
    );
    await clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-1"),
        authorUserAccountId: RESPONSIBLE,
        body: "Captions only.",
        parentId: question.id,
      }),
    );

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result?.clarificationThread).toMatchObject([
      { authorName: "Nadia Rahman", body: "How many need step-free access?", parentId: null },
      { authorName: "Priya Nair", body: "Captions only.", parentId: question.id },
    ]);
  });

  it("returns an empty thread for a request nobody has asked about", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({
      id: "request-1",
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result?.clarificationThread).toEqual([]);
  });
});
