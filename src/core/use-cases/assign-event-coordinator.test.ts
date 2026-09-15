import { describe, expect, it } from "vitest";

import { eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { InMemoryUserAccountRepository } from "@/adapters/outbound/in-memory/in-memory-user-account-repository";
import {
  EventCoordinatorNotFoundError,
  EventRequestNotAssignableError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestStatus,
} from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";
import type { EventCoordinatorDetails } from "@/core/ports/outbound/user-account-repository";

import { AssignEventCoordinatorUseCase } from "./assign-event-coordinator";

const OLD_COORDINATOR = userAccountId("coordinator-1");
const NEW_COORDINATOR = userAccountId("coordinator-2");

function coordinator(id: string): EventCoordinatorDetails {
  return {
    userAccountId: id,
    name: id,
    contactDetails: null,
    communicationPreferences: null,
    department: "Event Coordination",
    availability: null,
    clientOrganisationId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function request(overrides: Partial<EventRequest> = {}): EventRequest {
  return eventRequestFixture({
    status: "Submitted",
    submittedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  });
}

function buildUseCase(
  seed: readonly EventRequest[],
  coordinators: readonly EventCoordinatorDetails[] = [coordinator(NEW_COORDINATOR)],
) {
  const eventRequests = new InMemoryEventRequestRepository(seed);
  const useCase = new AssignEventCoordinatorUseCase({
    eventRequests,
    userAccounts: new InMemoryUserAccountRepository({ eventCoordinators: coordinators }),
  });
  return { useCase, eventRequests };
}

describe("AssignEventCoordinatorUseCase", () => {
  it("AC1: assigns an unassigned Submitted request and changes it to Under Review", async () => {
    const { useCase, eventRequests } = buildUseCase([request()]);

    const result = await useCase.execute({
      eventRequestId: "request-1",
      eventCoordinatorUserAccountId: NEW_COORDINATOR,
    });

    expect(result).toEqual({
      eventRequestId: "request-1",
      assignedCoordinatorUserAccountId: NEW_COORDINATOR,
      status: "Under Review",
      operation: "assigned",
    });
    await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toMatchObject({
      assignedCoordinatorUserAccountId: NEW_COORDINATOR,
      status: "Under Review",
    });
  });

  it("AC2: replaces the old coordinator with the new coordinator", async () => {
    const { useCase, eventRequests } = buildUseCase([
      request({
        status: "Under Review",
        assignedCoordinatorUserAccountId: OLD_COORDINATOR,
      }),
    ]);

    const result = await useCase.execute({
      eventRequestId: "request-1",
      eventCoordinatorUserAccountId: NEW_COORDINATOR,
    });

    expect(result.operation).toBe("reassigned");
    const saved = await eventRequests.findById(eventRequestId("request-1"));
    expect(saved?.assignedCoordinatorUserAccountId).toBe(NEW_COORDINATOR);
    expect(saved?.assignedCoordinatorUserAccountId).not.toBe(OLD_COORDINATOR);
    expect(saved?.status).toBe("Under Review");
  });

  it.each(["Under Review", "Approved", "Returned"] as const)(
    "preserves the %s status when assigning a coordinator",
    async (status) => {
      const { useCase, eventRequests } = buildUseCase([request({ status })]);

      const result = await useCase.execute({
        eventRequestId: "request-1",
        eventCoordinatorUserAccountId: NEW_COORDINATOR,
      });

      expect(result.status).toBe(status);
      expect((await eventRequests.findById(eventRequestId("request-1")))?.status).toBe(status);
    },
  );

  it.each(["Draft", "Withdrawn", "Rejected"] as const)(
    "rejects assignment when the request status is %s",
    async (status: EventRequestStatus) => {
      const existing = request({ status });
      const { useCase, eventRequests } = buildUseCase([existing]);

      await expect(
        useCase.execute({
          eventRequestId: "request-1",
          eventCoordinatorUserAccountId: NEW_COORDINATOR,
        }),
      ).rejects.toEqual(new EventRequestNotAssignableError(status));
      await expect(eventRequests.findById(eventRequestId("request-1"))).resolves.toBe(existing);
    },
  );

  it("rejects a user account that is not an Event Coordinator", async () => {
    const { useCase, eventRequests } = buildUseCase([request()], []);

    await expect(
      useCase.execute({
        eventRequestId: "request-1",
        eventCoordinatorUserAccountId: "ordinary-user",
      }),
    ).rejects.toBeInstanceOf(EventCoordinatorNotFoundError);
    expect(eventRequests.all()[0]?.assignedCoordinatorUserAccountId).toBeNull();
  });

  it("treats assigning the current coordinator again as an idempotent success", async () => {
    const existing = request({
      status: "Under Review",
      assignedCoordinatorUserAccountId: NEW_COORDINATOR,
    });
    const { useCase, eventRequests } = buildUseCase([existing]);

    const first = await useCase.execute({
      eventRequestId: "request-1",
      eventCoordinatorUserAccountId: NEW_COORDINATOR,
    });
    const second = await useCase.execute({
      eventRequestId: "request-1",
      eventCoordinatorUserAccountId: NEW_COORDINATOR,
    });

    expect(second).toEqual(first);
    expect(eventRequests.all()).toEqual([existing]);
  });

  it("rejects an unknown event request id", async () => {
    const { useCase } = buildUseCase([]);

    await expect(
      useCase.execute({
        eventRequestId: "missing",
        eventCoordinatorUserAccountId: NEW_COORDINATOR,
      }),
    ).rejects.toBeInstanceOf(EventRequestNotFoundError);
  });
});
