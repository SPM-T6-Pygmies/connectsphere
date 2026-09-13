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
    userAccounts: new InMemoryUserAccountRepository(ORGANISER_NAMES),
  });
}

describe("ViewAssignedEventRequestUseCase", () => {
  it("returns the request, with names, to its assigned coordinator", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result?.eventRequest.id).toBe(eventRequestId("request-1"));
    expect(result?.requestingOrganiserName).toBe("Alice");
    expect(result?.clientOrganisationName).toBe("Sunrise Events Co");
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
