import { describe, expect, it } from "vitest";

import { eventRequestDetails, eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewOperationsEventRequestUseCase } from "./view-operations-event-request";

describe("ViewOperationsEventRequestUseCase (SPM-29)", () => {
  it("returns the requested event request with its coordinator assignment", async () => {
    const request = eventRequestFixture({
      id: eventRequestId("42"),
      details: eventRequestDetails({
        eventName: "Leadership Workshop",
        description: "Workshop for department leaders",
      }),
      status: "Under Review",
      assignedCoordinatorUserAccountId: userAccountId("7"),
      updatedAt: new Date("2026-09-13T04:00:00.000Z"),
    });
    const useCase = new ViewOperationsEventRequestUseCase({
      clientOrganisations: new InMemoryClientOrganisationRepository(),
      eventRequests: new InMemoryEventRequestRepository([request]),
    });

    const result = await useCase.execute({ id: "42" });

    expect(result?.eventRequest).toMatchObject({
      id: "42",
      eventName: "Leadership Workshop",
      description: "Workshop for department leaders",
      status: "Under Review",
      assignedCoordinatorUserAccountId: "7",
      updatedAt: "2026-09-13T04:00:00.000Z",
    });
    expect(result?.canAssignCoordinator).toBe(true);
  });

  it("reports that a Rejected request cannot take a coordinator", async () => {
    const useCase = new ViewOperationsEventRequestUseCase({
      clientOrganisations: new InMemoryClientOrganisationRepository(),
      eventRequests: new InMemoryEventRequestRepository([
        eventRequestFixture({
          id: eventRequestId("42"),
          status: "Rejected",
          assignedCoordinatorUserAccountId: userAccountId("7"),
        }),
      ]),
    });

    const result = await useCase.execute({ id: "42" });

    expect(result?.canAssignCoordinator).toBe(false);
  });

  it("returns null when the event request does not exist", async () => {
    const useCase = new ViewOperationsEventRequestUseCase({
      clientOrganisations: new InMemoryClientOrganisationRepository(),
      eventRequests: new InMemoryEventRequestRepository(),
    });

    await expect(useCase.execute({ id: "404" })).resolves.toBeNull();
  });

  it("returns null for a Draft, exactly as for a request that does not exist", async () => {
    const draft = eventRequestFixture({ id: eventRequestId("42"), status: "Draft" });
    const useCase = new ViewOperationsEventRequestUseCase({
      clientOrganisations: new InMemoryClientOrganisationRepository(),
      eventRequests: new InMemoryEventRequestRepository([draft]),
    });

    await expect(useCase.execute({ id: "42" })).resolves.toBeNull();
  });
});

describe("ViewOperationsEventRequestUseCase (SPM-255)", () => {
  it("AC3: names the request's client organisation", async () => {
    const useCase = new ViewOperationsEventRequestUseCase({
      clientOrganisations: new InMemoryClientOrganisationRepository(
        new Map([[clientOrganisationId("org-a"), "Sunrise Events Co"]]),
      ),
      eventRequests: new InMemoryEventRequestRepository([
        eventRequestFixture({ id: eventRequestId("42"), status: "Submitted" }),
      ]),
    });

    const result = await useCase.execute({ id: "42" });

    expect(result?.eventRequest.clientOrganisationName).toBe("Sunrise Events Co");
  });

  it("AC4: returns null for a Withdrawn request that never had a coordinator", async () => {
    const useCase = new ViewOperationsEventRequestUseCase({
      clientOrganisations: new InMemoryClientOrganisationRepository(),
      eventRequests: new InMemoryEventRequestRepository([
        eventRequestFixture({ id: eventRequestId("42"), status: "Withdrawn" }),
      ]),
    });

    await expect(useCase.execute({ id: "42" })).resolves.toBeNull();
  });
});
