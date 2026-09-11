import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewAssignedEventRequestsUseCase } from "./view-assigned-event-requests";

const ORG_A = clientOrganisationId("org-a");
const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

const ORG_NAMES = new Map([[ORG_A, "Sunrise Events Co"]]);

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    assignedCoordinatorUserAccountId: COORDINATOR,
    status: "Under Review",
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  return new ViewAssignedEventRequestsUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed),
    clientOrganisations: new InMemoryClientOrganisationRepository(ORG_NAMES),
  });
}

describe("ViewAssignedEventRequestsUseCase", () => {
  it("lists a request assigned to the caller, with its client organisation's name", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toEqual([
      {
        id: "request-1",
        eventName: "Founders' Day",
        clientOrganisationName: "Sunrise Events Co",
        preferredDate: "2026-11-04",
        status: "Under Review",
      },
    ]);
  });

  it("never returns a request assigned to a different coordinator", async () => {
    const useCase = buildUseCase([request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toEqual([]);
  });

  it("includes a Returned request -- still open, ball back in the Organiser's court", async () => {
    const useCase = buildUseCase([request({ status: "Returned" })]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toHaveLength(1);
  });

  it.each(["Draft", "Submitted", "Approved", "Rejected", "Withdrawn"] as const)(
    "excludes a %s request even when assigned to the caller",
    async (status) => {
      const useCase = buildUseCase([request({ status })]);

      const result = await useCase.execute({ userAccountId: COORDINATOR });

      expect(result.eventRequests).toEqual([]);
    },
  );

  it("returns an empty list rather than an error when nothing is assigned", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toEqual([]);
  });
});
