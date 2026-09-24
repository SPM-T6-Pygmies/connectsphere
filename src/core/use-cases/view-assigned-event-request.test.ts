import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
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

function buildUseCase(seed: readonly EventRequest[]) {
  return new ViewAssignedEventRequestUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed),
    clientOrganisations: new InMemoryClientOrganisationRepository(ORG_NAMES),
    userAccounts: new InMemoryUserAccountRepository({ names: ORGANISER_NAMES }),
  });
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

describe("ViewAssignedEventRequestUseCase withdrawal (SPM-169)", () => {
  it("offers a withdrawal on a request under review", async () => {
    const useCase = buildUseCase([request({ status: "Under Review" })]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result?.canWithdraw).toBe(true);
  });

  it.each(["Submitted", "Returned", "Approved", "Rejected", "Withdrawn"] as const)(
    "offers no withdrawal on a %s request",
    async (status) => {
      const useCase = buildUseCase([request({ status })]);

      const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

      expect(result?.canWithdraw).toBe(false);
    },
  );

  it("files a withdrawn request in the Archive under its outcome", async () => {
    const useCase = buildUseCase([request({ status: "Withdrawn" })]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result).toMatchObject({ state: "withdrawn", section: "archive" });
  });
});
