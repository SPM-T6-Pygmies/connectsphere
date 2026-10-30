import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { CoordinatorEventNotFoundError, EventNotCancellableError } from "@/core/domain/errors";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { userAccountId } from "@/core/domain/user-account";

import { CancelEventUseCase } from "./cancel-event";

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

function buildUseCase(events: readonly SeedCoordinatorEvent[]) {
  const eventsRepo = new InMemoryCoordinatorEventRepository(events);
  const notifier = new RecordingNotifier();
  const useCase = new CancelEventUseCase({ events: eventsRepo, notifier });
  return { useCase, eventsRepo, notifier };
}

describe("CancelEventUseCase (SPM-55)", () => {
  it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Confirmed"])(
    "AC1, AC2: the assigned coordinator cancels a %s event, audited against them",
    async (status) => {
      const { useCase, eventsRepo } = buildUseCase([seedEvent({ status })]);

      const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

      expect(result).toEqual({ eventId: "event-1", status: "Cancelled" });
      expect(eventsRepo.all()).toEqual([expect.objectContaining({ status: "Cancelled" })]);
      expect(eventsRepo.activityTrail()).toEqual([
        { actorUserAccountId: COORDINATOR, eventId: "event-1", action: "cancelled" },
      ]);
    },
  );

  it.each<CoordinatorEventStatus>(["Completed", "Cancelled"])(
    "AC2: refuses a %s event and leaves it as it was",
    async (status) => {
      const { useCase, eventsRepo } = buildUseCase([seedEvent({ status })]);

      await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).rejects.toThrow(
        new EventNotCancellableError(status),
      );
      expect(eventsRepo.all()).toEqual([expect.objectContaining({ status })]);
      expect(eventsRepo.activityTrail()).toEqual([]);
    },
  );

  it("AC1: answers another coordinator as if the event did not exist, leaving it unchanged (#91)", async () => {
    const { useCase, eventsRepo } = buildUseCase([seedEvent()]);

    await expect(
      useCase.execute({ id: "event-1", userAccountId: OTHER_COORDINATOR }),
    ).rejects.toBeInstanceOf(CoordinatorEventNotFoundError);
    expect(eventsRepo.all()).toEqual([expect.objectContaining({ status: "Planning" })]);
  });

  it("AC1: refuses an event assigned to no one", async () => {
    const { useCase } = buildUseCase([seedEvent({ assignedCoordinatorUserAccountId: null })]);

    await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).rejects.toBeInstanceOf(
      CoordinatorEventNotFoundError,
    );
  });

  it("refuses an event that does not exist", async () => {
    const { useCase } = buildUseCase([]);

    await expect(useCase.execute({ id: "event-404", userAccountId: COORDINATOR })).rejects.toBeInstanceOf(
      CoordinatorEventNotFoundError,
    );
  });
});

describe("CancelEventUseCase notifies the Organiser (SPM-68)", () => {
  it("AC1, AC3, AC4: tells the event's Organiser it is cancelled, with the request to open", async () => {
    const { useCase, notifier } = buildUseCase([seedEvent({ status: "Confirmed" })]);

    await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(notifier.eventsCancelled).toEqual([
      {
        recipientUserAccountId: "organiser-1",
        eventId: "event-1",
        eventRequestId: "request-1",
        eventName: "Founders' Day",
      },
    ]);
  });

  it("AC4: still tells the Organiser when the request the event came from is gone", async () => {
    const { useCase, notifier } = buildUseCase([seedEvent({ eventRequestId: null })]);

    await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(notifier.eventsCancelled).toEqual([expect.objectContaining({ eventRequestId: null })]);
  });

  it.each<CoordinatorEventStatus>(["Completed", "Cancelled"])(
    "AC1: sends nothing when a %s event is refused",
    async (status) => {
      const { useCase, notifier } = buildUseCase([seedEvent({ status })]);

      await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).rejects.toThrow();
      expect(notifier.eventsCancelled).toEqual([]);
    },
  );

  it("access: sends nothing when another coordinator is refused", async () => {
    const { useCase, notifier } = buildUseCase([seedEvent()]);

    await expect(useCase.execute({ id: "event-1", userAccountId: OTHER_COORDINATOR })).rejects.toThrow();
    expect(notifier.eventsCancelled).toEqual([]);
  });

  it("race: sends nothing when the store refuses the cancellation, as CS076 does for the second of two", async () => {
    const eventsRepo = new InMemoryCoordinatorEventRepository([seedEvent()]);
    eventsRepo.cancelEvent = async () => {
      throw new EventNotCancellableError("Cancelled");
    };
    const notifier = new RecordingNotifier();
    const useCase = new CancelEventUseCase({ events: eventsRepo, notifier });

    await expect(useCase.execute({ id: "event-1", userAccountId: COORDINATOR })).rejects.toThrow(
      EventNotCancellableError,
    );
    expect(notifier.eventsCancelled).toEqual([]);
  });
});
