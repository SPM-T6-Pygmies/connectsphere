import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import {
  ClarificationNotResolvableError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ResolveClarificationUseCase } from "./resolve-clarification";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    status: "Returned",
    assignedCoordinatorUserAccountId: COORDINATOR,
    submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  });
}

function buildUseCase(seed: readonly EventRequest[]) {
  const eventRequests = new InMemoryEventRequestRepository(seed);
  const useCase = new ResolveClarificationUseCase({ eventRequests });
  return { useCase, eventRequests };
}

describe("ResolveClarificationUseCase (SPM-33)", () => {
  it("puts a returned request back to awaiting the Coordinator's decision (AC6)", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    const result = await useCase.execute({ id: "request-1", userAccountId: COORDINATOR });

    expect(result).toEqual({ eventRequestId: "request-1", status: "Under Review" });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      status: "Under Review",
    });
  });

  it.each(["Submitted", "Under Review", "Approved"] as const)(
    "refuses to resolve a %s request, which was never returned, and stores nothing",
    async (status) => {
      const existing = request({ status });
      const { useCase, eventRequests } = buildUseCase([existing]);

      await expect(
        useCase.execute({ id: "request-1", userAccountId: COORDINATOR }),
      ).rejects.toBeInstanceOf(ClarificationNotResolvableError);
      expect(eventRequests.all()).toEqual([existing]);
    },
  );

  it("answers an unknown id as not found", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({ id: "missing", userAccountId: COORDINATOR }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });

  it("answers another coordinator's request as not found, not as forbidden (AC7, #91)", async () => {
    const existing = request({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR });
    const { useCase, eventRequests } = buildUseCase([existing]);

    await expect(
      useCase.execute({ id: "request-1", userAccountId: COORDINATOR }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
    expect(eventRequests.all()).toEqual([existing]);
  });
});
