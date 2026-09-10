import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewEventRequestUseCase } from "./view-event-request";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const RESPONSIBLE = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: RESPONSIBLE,
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  return new ViewEventRequestUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed),
  });
}

describe("ViewEventRequestUseCase", () => {
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
