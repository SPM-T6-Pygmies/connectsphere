import { describe, expect, it } from "vitest";

import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { DraftNotEditableError } from "@/core/domain/errors";
import type { DiscardEventRequestDraftCommand } from "@/core/ports/inbound/discard-event-request-draft";
import { SaveEventRequestDraftUseCase } from "@/core/use-cases/save-event-request-draft";

import { DiscardEventRequestDraftUseCase } from "./discard-event-request-draft";

const ORGANISER = "u-01";
const OTHER_ORGANISER = "u-02";
const ORG = "org-a";
const OTHER_ORG = "org-b";

function command(
  overrides: Partial<DiscardEventRequestDraftCommand> = {},
): DiscardEventRequestDraftCommand {
  return {
    eventRequestId: "does-not-exist",
    responsibleOrganiserId: ORGANISER,
    clientOrganisationId: ORG,
    ...overrides,
  };
}

async function buildDraft(eventRequests: InMemoryEventRequestRepository) {
  const saveUseCase = new SaveEventRequestDraftUseCase({ eventRequests });
  const { eventRequestId } = await saveUseCase.execute({
    eventRequestId: null,
    responsibleOrganiserId: ORGANISER,
    clientOrganisationId: ORG,
    eventName: "Founders' Day",
    description: null,
    purpose: null,
    preferredDate: null,
    preferredStartTime: null,
    preferredEndTime: null,
    expectedAttendance: null,
    venueRequirements: null,
    roomLayoutPreferences: null,
    accessibilityNeeds: null,
    equipmentRequirements: null,
    registrationRequirements: null,
    generalProgramme: null,
    otherSpecialArrangements: null,
  });
  return eventRequestId;
}

function buildUseCase() {
  const eventRequests = new InMemoryEventRequestRepository();
  const useCase = new DiscardEventRequestDraftUseCase({ eventRequests });
  return { useCase, eventRequests };
}

describe("DiscardEventRequestDraftUseCase", () => {
  it("removes a draft its own Organiser started", async () => {
    const { useCase, eventRequests } = buildUseCase();
    const eventRequestId = await buildDraft(eventRequests);

    await useCase.execute(command({ eventRequestId }));

    expect(eventRequests.all()).toEqual([]);
  });

  it("refuses to discard a draft belonging to a different organiser", async () => {
    const { useCase, eventRequests } = buildUseCase();
    const eventRequestId = await buildDraft(eventRequests);

    await expect(
      useCase.execute(command({ eventRequestId, responsibleOrganiserId: OTHER_ORGANISER })),
    ).rejects.toBeInstanceOf(DraftNotEditableError);
    expect(eventRequests.all()).toHaveLength(1);
  });

  it("refuses to discard a draft from a different client organisation", async () => {
    const { useCase, eventRequests } = buildUseCase();
    const eventRequestId = await buildDraft(eventRequests);

    await expect(
      useCase.execute(command({ eventRequestId, clientOrganisationId: OTHER_ORG })),
    ).rejects.toBeInstanceOf(DraftNotEditableError);
    expect(eventRequests.all()).toHaveLength(1);
  });

  it("refuses to discard a request that has already left Draft", async () => {
    const { useCase, eventRequests } = buildUseCase();
    const eventRequestId = await buildDraft(eventRequests);
    const [stored] = eventRequests.all();
    await eventRequests.save({ ...stored!, status: "Submitted" });

    await expect(useCase.execute(command({ eventRequestId }))).rejects.toBeInstanceOf(
      DraftNotEditableError,
    );
    expect(eventRequests.all()).toHaveLength(1);
  });

  it("rejects an id that does not exist", async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute(command())).rejects.toBeInstanceOf(DraftNotEditableError);
  });
});
