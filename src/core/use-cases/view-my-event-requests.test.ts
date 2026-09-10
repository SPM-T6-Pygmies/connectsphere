import { describe, expect, it } from "vitest";

import { eventRequestDetails, eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewMyEventRequestsUseCase } from "./view-my-event-requests";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const ME = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: ME,
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  return new ViewMyEventRequestsUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed),
  });
}

describe("ViewMyEventRequestsUseCase", () => {
  it("returns the caller's own request with the fields the list screen needs", async () => {
    const submittedAt = new Date("2026-09-10T00:00:00.000Z");
    const useCase = buildUseCase([
      request({
        status: "Submitted",
        submittedAt,
        details: eventRequestDetails({ description: "A day for founders." }),
      }),
    ]);

    const result = await useCase.execute({
      userAccountId: ME,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([
      {
        id: "request-1",
        eventName: "Founders' Day",
        status: "Submitted",
        preferredDate: "2026-11-04",
        description: "A day for founders.",
        submittedAt,
      },
    ]);
  });

  it("never returns a colleague's request", async () => {
    const useCase = buildUseCase([request({ responsibleOrganiserId: COLLEAGUE })]);

    const result = await useCase.execute({
      userAccountId: ME,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([]);
  });

  it("never returns a request belonging to an unrelated client organisation", async () => {
    const useCase = buildUseCase([
      request({ clientOrganisationId: ORG_B, responsibleOrganiserId: ME }),
    ]);

    const result = await useCase.execute({
      userAccountId: ME,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([]);
  });

  it("returns an empty list rather than an error when the caller has no requests", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({
      userAccountId: ME,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([]);
  });
});
