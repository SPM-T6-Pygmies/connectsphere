import { describe, expect, it } from "vitest";

import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewOrganisationEventRequestsUseCase } from "./view-organisation-event-requests";

const ORG_A = clientOrganisationId("org-a");
const ORG_B = clientOrganisationId("org-b");
const RESPONSIBLE = userAccountId("organiser-1");
const COLLEAGUE = userAccountId("organiser-2");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return {
    id: eventRequestId("request-1"),
    eventName: "Founders' Day",
    status: "Draft",
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: RESPONSIBLE,
    ...overrides,
  };
}

function buildUseCase(seed: readonly EventRequest[]) {
  return new ViewOrganisationEventRequestsUseCase({
    eventRequests: new InMemoryEventRequestRepository(seed),
  });
}

describe("ViewOrganisationEventRequestsUseCase", () => {
  it("lists a colleague's Draft request as view-only, not editable", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({
      userAccountId: COLLEAGUE,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([
      { id: "request-1", eventName: "Founders' Day", status: "Draft", canEdit: false },
    ]);
  });

  it("lets the responsible Organiser edit their own request while it is Draft", async () => {
    const useCase = buildUseCase([request()]);

    const result = await useCase.execute({
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests[0]?.canEdit).toBe(true);
  });

  it("removes edit access from the responsible Organiser once submitted (#102)", async () => {
    const useCase = buildUseCase([request({ status: "Submitted" })]);

    const result = await useCase.execute({
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests[0]?.canEdit).toBe(false);
  });

  it("never returns a request belonging to an unrelated client organisation", async () => {
    const useCase = buildUseCase([request({ clientOrganisationId: ORG_B })]);

    const result = await useCase.execute({
      userAccountId: COLLEAGUE,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([]);
  });

  it("returns an empty list rather than an error when the caller's organisation has no requests", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({
      userAccountId: RESPONSIBLE,
      clientOrganisationId: ORG_A,
    });

    expect(result.eventRequests).toEqual([]);
  });
});
