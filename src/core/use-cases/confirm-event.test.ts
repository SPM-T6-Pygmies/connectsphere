import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryEventReadinessRepository } from "@/adapters/outbound/in-memory/in-memory-event-readiness-repository";
import { EventNotConfirmableError, EventNotFoundError, EventNotReadyForConfirmationError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import type { ArrangementReadiness, EventReadiness } from "@/core/domain/event-readiness";
import { userAccountId } from "@/core/domain/user-account";

import { ConfirmEventUseCase } from "./confirm-event";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

function seedEvent(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Founders' Day",
    clientOrganisationName: "Sunrise Events Co",
    preferredDate: "2026-10-14",
    status: "Planning",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: null,
    expectedAttendance: null,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    ...overrides,
  };
}

function seedReadiness(essentialArrangements: readonly ArrangementReadiness[]): EventReadiness {
  return { eventId: eventId("event-1"), essentialArrangements };
}

function buildUseCase(
  events: readonly SeedCoordinatorEvent[],
  readiness: readonly EventReadiness[] = [],
) {
  const eventsRepo = new InMemoryCoordinatorEventRepository(events);
  const readinessRepo = new InMemoryEventReadinessRepository(readiness);
  const useCase = new ConfirmEventUseCase({ events: eventsRepo, readiness: readinessRepo });
  return { useCase, eventsRepo };
}

describe("ConfirmEventUseCase", () => {
  it("confirms an event with every essential arrangement complete (AC1/AC2)", async () => {
    const { useCase, eventsRepo } = buildUseCase(
      [seedEvent()],
      [seedReadiness([{ type: "venue", complete: true }, { type: "programme", complete: true }])],
    );

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result).toEqual({ eventId: "event-1", status: "Confirmed" });
    expect(eventsRepo.all()).toEqual([expect.objectContaining({ status: "Confirmed" })]);
  });

  it("confirms even while a non-essential arrangement is incomplete (AC2)", async () => {
    const { useCase } = buildUseCase(
      [seedEvent()],
      [seedReadiness([{ type: "venue", complete: true }])],
    );

    await expect(
      useCase.execute({ id: "event-1", userAccountId: COORDINATOR }),
    ).resolves.toEqual({ eventId: "event-1", status: "Confirmed" });
  });

  it("refuses with the named blocking arrangements when one is incomplete, and stores nothing (AC1)", async () => {
    const { useCase, eventsRepo } = buildUseCase(
      [seedEvent()],
      [seedReadiness([{ type: "venue", complete: false }, { type: "programme", complete: true }])],
    );

    try {
      await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EventNotReadyForConfirmationError);
      expect((error as EventNotReadyForConfirmationError).blockingArrangements).toEqual(["venue"]);
    }
    expect(eventsRepo.all()).toEqual([expect.objectContaining({ status: "Planning" })]);
  });

  it("refuses an event that is not Planning", async () => {
    const { useCase } = buildUseCase([seedEvent({ status: "Blocked" })]);

    await expect(
      useCase.execute({ id: "event-1", userAccountId: COORDINATOR }),
    ).rejects.toBeInstanceOf(EventNotConfirmableError);
  });

  it.each([
    ["assigned to another coordinator", seedEvent({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })],
    ["not assigned to anyone", seedEvent({ assignedCoordinatorUserAccountId: null })],
  ])("answers an event %s as not found, and stores nothing (#91)", async (_label, existing) => {
    const { useCase, eventsRepo } = buildUseCase([existing]);

    await expect(
      useCase.execute({ id: "event-1", userAccountId: COORDINATOR }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
    expect(eventsRepo.all()).toEqual([existing]);
  });

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({ id: "missing", userAccountId: COORDINATOR }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });
});
