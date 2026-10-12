import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import {
  CoordinatorEventNotFoundError,
  EventNotCompletableError,
  EventNotYetEndedError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import { CompleteEventUseCase } from "./complete-event";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

/** The event's only slot, 14 Oct PM, ends 18:00 Singapore time. */
const ENDS_AT = new Date("2026-10-14T18:00:00+08:00");
const AFTER_END = new Date("2026-10-15T09:00:00+08:00");

function seedEvent(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Founders' Day",
    clientOrganisationName: "Sunrise Events Co",
    preferredDate: "2026-10-14",
    slots: [{ date: "2026-10-14", slot: "PM" }],
    status: "Confirmed",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: null,
    expectedAttendance: null,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    operationalNotes: "Doors at 9.",
    ...overrides,
  };
}

function buildUseCase(events: readonly SeedCoordinatorEvent[], now: Date = AFTER_END) {
  const eventsRepo = new InMemoryCoordinatorEventRepository(events);
  const useCase = new CompleteEventUseCase({ events: eventsRepo, clock: new FixedClock(now) });
  return { useCase, eventsRepo };
}

describe("CompleteEventUseCase (SPM-51)", () => {
  it("AC1: marks a Confirmed event Completed once it has ended", async () => {
    const { useCase, eventsRepo } = buildUseCase([seedEvent()]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result).toEqual({ eventId: "event-1", status: "Completed" });
    expect(eventsRepo.all()).toEqual([expect.objectContaining({ status: "Completed" })]);
  });

  it("AC1: completes exactly when the last slot ends", async () => {
    const { useCase } = buildUseCase([seedEvent()], ENDS_AT);

    await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).resolves.toEqual({
      eventId: "event-1",
      status: "Completed",
    });
  });

  it("AC2: saves the operational notes recorded at completion, audited against the coordinator", async () => {
    const { useCase, eventsRepo } = buildUseCase([seedEvent()]);

    await useCase.execute({ id: "event-1", userAccountId: COORDINATOR, notes: "  Ran 20 minutes over.  " });

    expect(eventsRepo.all()).toEqual([
      expect.objectContaining({ status: "Completed", operationalNotes: "Ran 20 minutes over." }),
    ]);
    expect(eventsRepo.auditTrail()).toEqual([
      {
        actorUserAccountId: COORDINATOR,
        eventId: "event-1",
        field: "operationalNotes",
        oldValue: "Doors at 9.",
        newValue: "Ran 20 minutes over.",
      },
    ]);
  });

  it.each([
    ["no notes", undefined],
    ["empty notes", ""],
    ["blank notes", "   "],
  ])("keeps the existing notes with %s, and audits no notes change", async (_label, notes) => {
    const { useCase, eventsRepo } = buildUseCase([seedEvent()]);

    await useCase.execute({ id: "event-1", userAccountId: COORDINATOR, notes });

    expect(eventsRepo.all()).toEqual([
      expect.objectContaining({ status: "Completed", operationalNotes: "Doors at 9." }),
    ]);
    expect(eventsRepo.auditTrail()).toEqual([]);
  });

  it("attributes the completion to the coordinator who made it", async () => {
    const { useCase, eventsRepo } = buildUseCase([seedEvent()]);

    await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(eventsRepo.activityTrail()).toEqual([
      { actorUserAccountId: COORDINATOR, eventId: "event-1", action: "completed" },
    ]);
  });

  it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Completed", "Cancelled"])(
    "refuses a %s event, and stores nothing",
    async (status) => {
      const existing = seedEvent({ status });
      const { useCase, eventsRepo } = buildUseCase([existing]);

      await expect(
        useCase.execute({ id: "event-1", userAccountId: COORDINATOR, notes: "Ran over." }),
      ).rejects.toThrow(new EventNotCompletableError(status));
      expect(eventsRepo.all()).toEqual([existing]);
      expect(eventsRepo.activityTrail()).toEqual([]);
    },
  );

  it("refuses a millisecond before the event ends, and stores nothing", async () => {
    const existing = seedEvent();
    const { useCase, eventsRepo } = buildUseCase([existing], new Date(ENDS_AT.getTime() - 1));

    await expect(
      useCase.execute({ id: "event-1", userAccountId: COORDINATOR, notes: "Ran over." }),
    ).rejects.toBeInstanceOf(EventNotYetEndedError);
    expect(eventsRepo.all()).toEqual([existing]);
  });

  it("refuses an event with no slots, whose end is unknown", async () => {
    const { useCase } = buildUseCase([seedEvent({ slots: [] })]);

    await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).rejects.toBeInstanceOf(
      EventNotYetEndedError,
    );
  });

  it.each([
    ["assigned to another coordinator", seedEvent({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })],
    ["not assigned to anyone", seedEvent({ assignedCoordinatorUserAccountId: null })],
  ])("answers an event %s as not found, and stores nothing (#91)", async (_label, existing) => {
    const { useCase, eventsRepo } = buildUseCase([existing]);

    await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).rejects.toBeInstanceOf(
      CoordinatorEventNotFoundError,
    );
    expect(eventsRepo.all()).toEqual([existing]);
  });

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(useCase.execute({ id: "missing", userAccountId: COORDINATOR })).rejects.toBeInstanceOf(
      CoordinatorEventNotFoundError,
    );
  });
});
