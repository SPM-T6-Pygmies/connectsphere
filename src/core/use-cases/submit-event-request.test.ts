import { describe, expect, it } from "vitest";

import {
  eventRequestDetails,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { DraftNotEditableError, IncompleteEventRequestError } from "@/core/domain/errors";
import { eventRequestAccessFor, eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { SubmitEventRequestCommand } from "@/core/use-cases/submit-event-request";

import { SubmitEventRequestUseCase } from "./submit-event-request";

const NOW = new Date("2026-09-09T10:00:00.000Z");
const ORGANISER = "u-01";
const ORG = "org-a";

function command(overrides: Partial<SubmitEventRequestCommand> = {}): SubmitEventRequestCommand {
  return {
    eventRequestId: null,
    responsibleOrganiserId: ORGANISER,
    clientOrganisationId: ORG,
    organiserTimeZone: "UTC",
    ...eventRequestDetails(),
    ...overrides,
  };
}

function buildUseCase() {
  const eventRequests = new InMemoryEventRequestRepository();
  const useCase = new SubmitEventRequestUseCase({
    eventRequests,
    clock: new FixedClock(NOW),
  });
  return { useCase, eventRequests };
}

describe("SubmitEventRequestUseCase", () => {
  it("records a complete request and reports it as submitted (AC2)", async () => {
    const { useCase, eventRequests } = buildUseCase();

    const result = await useCase.execute(command());

    expect(result.status).toBe("Submitted");
    expect(result.submittedAt).toBe(NOW.toISOString());
    expect(result.eventRequestId).toBe("request-1");

    const stored = await eventRequests.findById(
      (await eventRequests.listByClientOrganisation(clientOrganisationId(ORG)))[0]!.id,
    );
    expect(stored?.status).toBe("Submitted");
    expect(stored?.submittedAt).toEqual(NOW);
  });

  it("stores every field the organiser filled in, not just the mandatory ones", async () => {
    const { useCase, eventRequests } = buildUseCase();

    await useCase.execute(
      command({
        description: "Annual gathering for our clients.",
        purpose: "Relationship building",
        venueRequirements: "Central, step-free",
        roomLayoutPreferences: "Theatre",
        accessibilityNeeds: "Hearing loop",
        equipmentRequirements: "Projector, 2 mics",
        registrationRequirements: "Invite only",
        generalProgramme: "09:00 keynote, 10:30 breakouts",
        otherSpecialArrangements: "Halal catering",
      }),
    );

    const [stored] = eventRequests.all();
    expect(stored?.details).toEqual({
      eventName: "Founders' Day",
      description: "Annual gathering for our clients.",
      purpose: "Relationship building",
      preferredDate: "2026-11-04",
      preferredStartTime: "2026-11-04T09:00",
      preferredEndTime: "2026-11-04T17:00",
      expectedAttendance: 120,
      venueRequirements: "Central, step-free",
      roomLayoutPreferences: "Theatre",
      accessibilityNeeds: "Hearing loop",
      equipmentRequirements: "Projector, 2 mics",
      registrationRequirements: "Invite only",
      generalProgramme: "09:00 keynote, 10:30 breakouts",
      otherSpecialArrangements: "Halal catering",
    });
  });

  it("reads the confirmation back from what was stored (AC2)", async () => {
    const { useCase } = buildUseCase();

    const result = await useCase.execute(
      command({ eventName: "Q4 Partner Summit", expectedAttendance: 240 }),
    );

    expect(result.summary).toEqual({
      eventName: "Q4 Partner Summit",
      preferredDate: "2026-11-04",
      preferredStartTime: "2026-11-04T09:00",
      preferredEndTime: "2026-11-04T17:00",
      expectedAttendance: 240,
    });
  });

  it("refuses an incomplete request before touching the repository (AC3)", async () => {
    const { useCase, eventRequests } = buildUseCase();

    await expect(
      useCase.execute(command({ preferredDate: null, expectedAttendance: null })),
    ).rejects.toBeInstanceOf(IncompleteEventRequestError);

    expect(eventRequests.all()).toEqual([]);
  });

  it("names every missing field, so one round trip tells the organiser everything (AC3)", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute(command({ eventName: "  ", preferredStartTime: null })),
    ).rejects.toMatchObject({ missing: ["eventName", "preferredStartTime"] });
  });

  it("rejects a blank organiser or organisation rather than storing an unowned request", async () => {
    const { useCase, eventRequests } = buildUseCase();

    await expect(useCase.execute(command({ responsibleOrganiserId: "" }))).rejects.toThrow();
    await expect(useCase.execute(command({ clientOrganisationId: "" }))).rejects.toThrow();

    expect(eventRequests.all()).toEqual([]);
  });

  it("leaves the submitted request read-only to its own organiser (AC4)", async () => {
    const { useCase, eventRequests } = buildUseCase();

    await useCase.execute(command());
    const [stored] = eventRequests.all();

    expect(
      eventRequestAccessFor(stored!, {
        userAccountId: userAccountId(ORGANISER),
        clientOrganisationId: clientOrganisationId(ORG),
      }),
    ).toBe("view");
  });

  it("gives each submission its own id", async () => {
    const { useCase } = buildUseCase();

    const first = await useCase.execute(command());
    const second = await useCase.execute(command({ eventName: "Another event" }));

    expect(first.eventRequestId).not.toBe(second.eventRequestId);
  });

  describe("completing an existing draft (SPM-38)", () => {
    function seedDraft(eventRequests: InMemoryEventRequestRepository) {
      const draft = eventRequestFixture({
        id: eventRequestId("draft-1"),
        status: "Draft",
        submittedAt: null,
        clientOrganisationId: clientOrganisationId(ORG),
        responsibleOrganiserId: userAccountId(ORGANISER),
      });
      return eventRequests.save(draft).then(() => draft);
    }

    it("finishes the same row instead of raising a second one", async () => {
      const { useCase, eventRequests } = buildUseCase();
      const draft = await seedDraft(eventRequests);

      const result = await useCase.execute(command({ eventRequestId: draft.id }));

      expect(result.eventRequestId).toBe(draft.id);
      expect(eventRequests.all()).toHaveLength(1);
      expect(eventRequests.all()[0]?.status).toBe("Submitted");
    });

    it("refuses to complete someone else's draft", async () => {
      const { useCase, eventRequests } = buildUseCase();
      const draft = await seedDraft(eventRequests);

      await expect(
        useCase.execute(
          command({ eventRequestId: draft.id, responsibleOrganiserId: "someone-else" }),
        ),
      ).rejects.toBeInstanceOf(DraftNotEditableError);
    });

    it("refuses to resubmit a request that has already left Draft", async () => {
      const { useCase, eventRequests } = buildUseCase();
      const draft = await seedDraft(eventRequests);
      await eventRequests.save({ ...draft, status: "Submitted" });

      await expect(
        useCase.execute(command({ eventRequestId: draft.id })),
      ).rejects.toBeInstanceOf(DraftNotEditableError);
    });

    it("still refuses an incomplete draft before writing anything", async () => {
      const { useCase, eventRequests } = buildUseCase();
      const draft = await seedDraft(eventRequests);

      await expect(
        useCase.execute(
          command({ eventRequestId: draft.id, preferredDate: null, expectedAttendance: null }),
        ),
      ).rejects.toBeInstanceOf(IncompleteEventRequestError);

      expect(eventRequests.all()[0]?.status).toBe("Draft");
    });
  });
});
