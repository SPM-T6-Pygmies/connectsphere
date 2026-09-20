import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewArchivedEventRequestsUseCase } from "./view-archived-event-requests";

const ORG_A = clientOrganisationId("org-a");
const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

const ORG_NAMES = new Map([[ORG_A, "Sunrise Events Co"]]);

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    assignedCoordinatorUserAccountId: COORDINATOR,
    status: "Rejected",
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  return new ViewArchivedEventRequestsUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed),
    clientOrganisations: new InMemoryClientOrganisationRepository(ORG_NAMES),
  });
}

describe("ViewArchivedEventRequestsUseCase (SPM-29)", () => {
  it("lists a rejected request assigned to the caller, with its client organisation's name", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toEqual([
      {
        id: "request-1",
        eventName: "Founders' Day",
        clientOrganisationName: "Sunrise Events Co",
        preferredDate: "2026-11-04",
        state: "rejected",
      },
    ]);
  });

  it("lists a withdrawn request, marked as withdrawn", async () => {
    const useCase = buildUseCase([request({ status: "Withdrawn" })]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests[0]?.state).toBe("withdrawn");
  });

  it("never returns a request assigned to a different coordinator", async () => {
    const useCase = buildUseCase([request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toEqual([]);
  });

  it.each(["Draft", "Submitted", "Under Review", "Returned", "Approved"] as const)(
    "excludes a %s request -- it is still open, or became an event",
    async (status) => {
      const useCase = buildUseCase([request({ status })]);

      const result = await useCase.execute({ userAccountId: COORDINATOR });

      expect(result.eventRequests).toEqual([]);
    },
  );

  it("returns an empty list rather than an error when nothing is archived", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.eventRequests).toEqual([]);
  });
});
