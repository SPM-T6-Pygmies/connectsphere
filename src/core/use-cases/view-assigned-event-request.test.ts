import { describe, expect, it } from "vitest";

import {
  clarificationMessage,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryClarificationThreadRepository } from "@/adapters/outbound/in-memory/in-memory-clarification-thread-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { InMemoryUserAccountRepository } from "@/adapters/outbound/in-memory/in-memory-user-account-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewAssignedEventRequestUseCase } from "./view-assigned-event-request";

const ORG_A = clientOrganisationId("org-a");
const RESPONSIBLE = userAccountId("organiser-1");
const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

const ORG_NAMES = new Map([[ORG_A, "Sunrise Events Co"]]);
const ORGANISER_NAMES = new Map([[RESPONSIBLE, "Alice"]]);

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: RESPONSIBLE,
    assignedCoordinatorUserAccountId: COORDINATOR,
    status: "Under Review",
    ...overrides,
  });
}

function buildHarness(seed: readonly EventRequest[]) {
  const clarificationThread = new InMemoryClarificationThreadRepository();
  const useCase = new ViewAssignedEventRequestUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed, clarificationThread),
    clarificationThread,
    clientOrganisations: new InMemoryClientOrganisationRepository(ORG_NAMES),
    userAccounts: new InMemoryUserAccountRepository({ names: ORGANISER_NAMES }),
  });
  return { useCase, clarificationThread };
}

function buildUseCase(seed: readonly EventRequest[]) {
  return buildHarness(seed).useCase;
}

describe("ViewAssignedEventRequestUseCase (SPM-124)", () => {
  it("returns the request, with names, to its assigned coordinator", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result?.eventRequest.id).toBe(eventRequestId("request-1"));
    expect(result?.requestingOrganiserName).toBe("Alice");
    expect(result?.clientOrganisationName).toBe("Sunrise Events Co");
    expect(result?.state).toBe("awaiting-decision");
    expect(result?.section).toBe("requests");
  });

  it("files a decided request where its outcome puts it", async () => {
    const approved = buildUseCase([request({ status: "Approved" })]);
    const rejected = buildUseCase([request({ status: "Rejected" })]);

    const approvedResult = await approved.execute({ id: "request-1", userAccountId: COORDINATOR });
    const rejectedResult = await rejected.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(approvedResult).toMatchObject({ state: "approved", section: "events" });
    expect(rejectedResult).toMatchObject({ state: "rejected", section: "archive" });
  });

  it("returns null for a coordinator the request is not assigned to", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({ id: "request-1", userAccountId: OTHER_COORDINATOR });

    expect(result).toBeNull();
  });

  it("returns null for a request with no assigned coordinator yet", async () => {
    const useCase = buildUseCase([request({ assignedCoordinatorUserAccountId: null })]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result).toBeNull();
  });

  it("returns null for an id that does not exist", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result).toBeNull();
  });
});

describe("ViewAssignedEventRequestUseCase clarification thread (SPM-33)", () => {
  it("returns the exchange alongside the request, so one access check covers both (AC4)", async () => {
    const { useCase, clarificationThread } = buildHarness([request({ status: "Returned" })]);
    await clarificationThread.append(
      clarificationMessage({
        eventRequestId: eventRequestId("request-1"),
        authorUserAccountId: COORDINATOR,
        body: "How many need step-free access?",
        parentId: null,
      }),
    );

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result?.clarificationThread).toMatchObject([
      { body: "How many need step-free access?", parentId: null },
    ]);
    // A Returned request still reads as waiting on the Organiser while staying
    // decidable -- SPM-33 decision 4.
    expect(result?.state).toBe("with-organiser");
  });

  it("returns an empty thread for a request nobody has asked about", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result?.clarificationThread).toEqual([]);
  });
});

describe("ViewAssignedEventRequestUseCase thread closing (SPM-33)", () => {
  it.each([
    ["Returned", true],
    ["Under Review", true],
    ["Approved", false],
    ["Rejected", false],
    ["Withdrawn", false],
  ] as const)("reports whether a %s request's thread takes messages", async (status, open) => {
    const useCase = buildUseCase([request({ status })]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result?.canDiscuss).toBe(open);
  });
});

