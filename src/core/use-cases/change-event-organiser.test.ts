import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { EventRequestNotFoundError } from "@/core/domain/errors";
import {
  eventRequestAccessFor,
  eventRequestId,
  type EventRequest,
} from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ChangeEventOrganiserUseCase } from "./change-event-organiser";

const ORG_A = clientOrganisationId("org-a");
const OUTGOING = userAccountId("organiser-1");
const INCOMING = userAccountId("organiser-2");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    clientOrganisationId: ORG_A,
    responsibleOrganiserId: OUTGOING,
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  const eventRequests = new InMemoryEventRequestRepository(seed);
  const useCase = new ChangeEventOrganiserUseCase({ eventRequests });
  return { useCase, eventRequests };
}

describe("ChangeEventOrganiserUseCase", () => {
  it("removes the outgoing Organiser's edit access and grants the incoming one's", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    await useCase.execute({
      eventRequestId: "request-1",
      newResponsibleOrganiserId: "organiser-2",
    });

    const saved = await eventRequests.findById(eventRequestId("request-1"));
    const organisation = { clientOrganisationId: ORG_A };

    expect(eventRequestAccessFor(saved!, { ...organisation, userAccountId: OUTGOING })).toBe("view");
    expect(eventRequestAccessFor(saved!, { ...organisation, userAccountId: INCOMING })).toBe("edit");
  });

  it("returns the reassigned request's new responsible Organiser", async () => {
    const { useCase } = buildUseCase([request()]);

    const result = await useCase.execute({
      eventRequestId: "request-1",
      newResponsibleOrganiserId: "organiser-2",
    });

    expect(result).toEqual({ eventRequestId: "request-1", responsibleOrganiserId: "organiser-2" });
  });

  it("rejects an unknown event request id", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({ eventRequestId: "nope", newResponsibleOrganiserId: "organiser-2" }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });
});
