import { describe, expect, it } from "vitest";

import { eventRequestDetails } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { DraftNotEditableError, IncompleteEventRequestError } from "@/core/domain/errors";
import { eventRequestAccessFor } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";
import type { SaveEventRequestDraftCommand } from "@/core/ports/inbound/save-event-request-draft";

import { SaveEventRequestDraftUseCase } from "./save-event-request-draft";

const ORGANISER = "u-01";
const OTHER_ORGANISER = "u-02";
const ORG = "org-a";
const OTHER_ORG = "org-b";

function command(
  overrides: Partial<SaveEventRequestDraftCommand> = {},
): SaveEventRequestDraftCommand {
  return {
    eventRequestId: null,
    responsibleOrganiserId: ORGANISER,
    clientOrganisationId: ORG,
    ...eventRequestDetails(),
    ...overrides,
  };
}

function buildUseCase() {
  const eventRequests = new InMemoryEventRequestRepository();
  const useCase = new SaveEventRequestDraftUseCase({ eventRequests });
  return { useCase, eventRequests };
}

describe("SaveEventRequestDraftUseCase", () => {
  it("stores a new draft with whatever was filled in, no mandatory fields required (AC1)", async () => {
    const { useCase, eventRequests } = buildUseCase();

    const result = await useCase.execute(
      command({ preferredDate: null, preferredStartTime: null, expectedAttendance: null }),
    );

    const [stored] = eventRequests.all();
    expect(stored?.id).toBe(result.eventRequestId);
    expect(stored?.status).toBe("Draft");
    expect(stored?.submittedAt).toBeNull();
    expect(stored?.details.preferredDate).toBeNull();
  });

  it("refuses a draft with no name", async () => {
    const { useCase, eventRequests } = buildUseCase();

    await expect(useCase.execute(command({ eventName: "" }))).rejects.toBeInstanceOf(
      IncompleteEventRequestError,
    );
    expect(eventRequests.all()).toEqual([]);
  });

  it("updates the same draft in place on a second save, rather than creating another (AC2)", async () => {
    const { useCase, eventRequests } = buildUseCase();

    const first = await useCase.execute(command({ eventName: "Founders' Day" }));
    const second = await useCase.execute(
      command({ eventRequestId: first.eventRequestId, eventName: "Founders' Day (updated)" }),
    );

    expect(second.eventRequestId).toBe(first.eventRequestId);
    expect(eventRequests.all()).toHaveLength(1);
    expect(eventRequests.all()[0]?.details.eventName).toBe("Founders' Day (updated)");
  });

  it("leaves the draft editable by its own Organiser (AC2)", async () => {
    const { useCase, eventRequests } = buildUseCase();

    const result = await useCase.execute(command());
    const [stored] = eventRequests.all();

    expect(
      eventRequestAccessFor(stored!, {
        userAccountId: userAccountId(ORGANISER),
        clientOrganisationId: clientOrganisationId(ORG),
      }),
    ).toBe("edit");
    expect(result.eventRequestId).toBe(stored!.id);
  });

  it("refuses to update a draft belonging to a different organiser", async () => {
    const { useCase } = buildUseCase();

    const first = await useCase.execute(command());

    await expect(
      useCase.execute(
        command({ eventRequestId: first.eventRequestId, responsibleOrganiserId: OTHER_ORGANISER }),
      ),
    ).rejects.toBeInstanceOf(DraftNotEditableError);
  });

  it("refuses to update a draft from a different client organisation", async () => {
    const { useCase } = buildUseCase();

    const first = await useCase.execute(command());

    await expect(
      useCase.execute(
        command({ eventRequestId: first.eventRequestId, clientOrganisationId: OTHER_ORG }),
      ),
    ).rejects.toBeInstanceOf(DraftNotEditableError);
  });

  it("refuses to edit a request that has already left Draft", async () => {
    const { useCase, eventRequests } = buildUseCase();

    const first = await useCase.execute(command());
    const [stored] = eventRequests.all();
    await eventRequests.save({ ...stored!, status: "Submitted" });

    await expect(
      useCase.execute(command({ eventRequestId: first.eventRequestId })),
    ).rejects.toBeInstanceOf(DraftNotEditableError);
  });

  it("rejects an id that does not exist", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute(command({ eventRequestId: "does-not-exist" })),
    ).rejects.toBeInstanceOf(DraftNotEditableError);
  });
});
