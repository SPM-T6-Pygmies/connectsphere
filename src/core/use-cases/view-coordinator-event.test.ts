import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryEventReadinessRepository } from "@/adapters/outbound/in-memory/in-memory-event-readiness-repository";
import { eventId } from "@/core/domain/event";
import type { ArrangementReadiness, EventReadiness } from "@/core/domain/event-readiness";
import { userAccountId } from "@/core/domain/user-account";

import { ViewCoordinatorEventUseCase } from "./view-coordinator-event";

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
  return new ViewCoordinatorEventUseCase({
    events: new InMemoryCoordinatorEventRepository(events),
    readiness: new InMemoryEventReadinessRepository(readiness),
  });
}

describe("ViewCoordinatorEventUseCase", () => {
  it("reports confirmable when every essential arrangement is complete", async () => {
    const useCase = buildUseCase(
      [seedEvent()],
      [seedReadiness([{ type: "venue", complete: true }])],
    );

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.canConfirm).toBe(true);
    expect(result?.blockingArrangements).toEqual([]);
  });

  it("names what blocks confirmation when an essential arrangement is incomplete", async () => {
    const useCase = buildUseCase(
      [seedEvent()],
      [seedReadiness([{ type: "venue", complete: false }, { type: "programme", complete: true }])],
    );

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.canConfirm).toBe(false);
    expect(result?.blockingArrangements).toEqual(["venue"]);
  });

  it("reports not confirmable once the event is past Planning, even with nothing blocking", async () => {
    const useCase = buildUseCase([seedEvent({ status: "Confirmed" })]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.canConfirm).toBe(false);
  });

  it.each([
    ["assigned to another coordinator", seedEvent({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })],
    ["not assigned to anyone", seedEvent({ assignedCoordinatorUserAccountId: null })],
  ])("answers an event %s as not found (#91)", async (_label, existing) => {
    const useCase = buildUseCase([existing]);

    await expect(
      useCase.execute({ id: "event-1", userAccountId: COORDINATOR }),
    ).resolves.toBeNull();
  });

  it("answers an unknown id as not found", async () => {
    const useCase = buildUseCase([]);

    await expect(
      useCase.execute({ id: "missing", userAccountId: COORDINATOR }),
    ).resolves.toBeNull();
  });
});
