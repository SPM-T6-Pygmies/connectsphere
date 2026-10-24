import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { InMemoryEventReadinessRepository } from "@/adapters/outbound/in-memory/in-memory-event-readiness-repository";
import { InMemoryUserAccountRepository } from "@/adapters/outbound/in-memory/in-memory-user-account-repository";
import { InMemoryVenueUnavailabilityRepository } from "@/adapters/outbound/in-memory/in-memory-venue-unavailability-repository";
import { safetyCheckReview, safetyCheckStore } from "@/adapters/outbound/in-memory/safety-check-fixture";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { eventId } from "@/core/domain/event";
import type { ReadinessFacts } from "@/core/domain/event-readiness";
import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type { SafetyCheckEntry } from "@/core/ports/outbound/safety-check-repository";

import { ViewCoordinatorEventUseCase } from "./view-coordinator-event";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");
const ORG_A = clientOrganisationId("org-a");
const REQUESTER = userAccountId("organiser-1");

const ORG_NAMES = new Map([[ORG_A, "Sunrise Events Co"]]);
const ORGANISER_NAMES = new Map([[REQUESTER, "Alice"]]);

function seedEvent(
  overrides: Partial<SeedCoordinatorEvent> = {},
): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Founders' Day",
    clientOrganisationName: "Sunrise Events Co",
    preferredDate: "2026-10-14",
    status: "Planning",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: "A showcase of this year's founding milestones.",
    expectedAttendance: 120,
    statedEquipmentNeeds: null,
    clientOrganisationId: ORG_A,
    owningOrganiserUserAccountId: REQUESTER,
    ...overrides,
  };
}

/** Facts for event-1, every arrangement incomplete unless overridden. */
function seedFacts(overrides: Partial<ReadinessFacts> = {}): ReadinessFacts {
  return {
    eventId: eventId("event-1"),
    essentialTypes: [],
    confirmedVenueLocation: null,
    programmeAgenda: null,
    registrationEnabled: false,
    registrationOpenDate: null,
    registrationCloseDate: null,
    essentialEquipment: [],
    ...overrides,
  };
}

function check(overrides: Partial<SafetyCheckEntry> = {}): SafetyCheckEntry {
  return {
    outcome: "Approved",
    comments: null,
    checkedByName: "Test Safety Officer",
    checkedAt: "2026-10-06T09:30:00.000Z",
    resubmittedAt: null,
    ...overrides,
  };
}

const APPROVED = check();
const REJECTED = check({ outcome: "Rejected", comments: "Widen the fire exit route." });

/** The morning after event-1's 14 Oct PM slot. */
const AFTER_END = new Date("2026-10-15T09:00:00+08:00");

function buildUseCase(
  events: readonly SeedCoordinatorEvent[],
  readiness: readonly ReadinessFacts[] = [],
  now: Date = AFTER_END,
  /** Every event's safety-check history, newest first -- one approval unless given. */
  checks: readonly SafetyCheckEntry[] = [APPROVED],
  flags: InMemoryVenueUnavailabilityRepository = new InMemoryVenueUnavailabilityRepository(new FixedClock(now)),
) {
  return new ViewCoordinatorEventUseCase({
    flags,
    events: new InMemoryCoordinatorEventRepository(events),
    readiness: new InMemoryEventReadinessRepository(
      readiness,
      new Map(
        events.flatMap((event) =>
          event.assignedCoordinatorUserAccountId === null
            ? []
            : [[event.id, event.assignedCoordinatorUserAccountId] as const],
        ),
      ),
    ),
    clientOrganisations: new InMemoryClientOrganisationRepository(ORG_NAMES),
    userAccounts: new InMemoryUserAccountRepository({ names: ORGANISER_NAMES }),
    clock: new FixedClock(now),
    safetyChecks: safetyCheckStore(
      events.map((event) =>
        safetyCheckReview({ coordinatorUserAccountId: event.assignedCoordinatorUserAccountId, checks }),
      ),
    ),
  });
}

describe("ViewCoordinatorEventUseCase (SPM-50)", () => {
  it("resolves the event's client organisation and requesting Organiser by name", async () => {
    const useCase = buildUseCase([seedEvent()]);

    const result = await useCase.execute({
      id: "event-1",
      userAccountId: COORDINATOR,
    });

    expect(result?.clientOrganisationName).toBe("Sunrise Events Co");
    expect(result?.owningOrganiserName).toBe("Alice");
  });

  it("reports confirmable when every essential arrangement is complete", async () => {
    const useCase = buildUseCase(
      [seedEvent()],
      [seedFacts({ essentialTypes: ["venue"], confirmedVenueLocation: "Main Hall" })],
    );

    const result = await useCase.execute({
      id: "event-1",
      userAccountId: COORDINATOR,
    });

    expect(result?.confirmation).toBe("ready");
    expect(result?.blockingArrangements).toEqual([]);
  });

  it("names what blocks confirmation when an essential arrangement is incomplete", async () => {
    const useCase = buildUseCase(
      [seedEvent()],
      [
        seedFacts({
          essentialTypes: ["venue", "programme"],
          programmeAgenda: "Talks, then lunch",
        }),
      ],
    );

    const result = await useCase.execute({
      id: "event-1",
      userAccountId: COORDINATOR,
    });

    expect(result?.confirmation).toBe("blocked");
    expect(result?.blockingArrangements).toEqual(["venue"]);
  });

  it.each([
    ["Confirmed", "already-confirmed"],
    ["Completed", "already-confirmed"],
    ["Blocked", "not-in-planning"],
    ["Cancelled", "not-in-planning"],
  ] as const)(
    "reports a %s event as %s, not ready, even with nothing blocking",
    async (status, confirmation) => {
      const useCase = buildUseCase([seedEvent({ status })]);

      const result = await useCase.execute({
        id: "event-1",
        userAccountId: COORDINATOR,
      });

      expect(result?.confirmation).toBe(confirmation);
    },
  );

  it.each([
    [
      "assigned to another coordinator",
      seedEvent({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR }),
    ],
    [
      "not assigned to anyone",
      seedEvent({ assignedCoordinatorUserAccountId: null }),
    ],
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

describe("ViewCoordinatorEventUseCase safety check (SPM-264)", () => {
  const ready = () => [seedFacts({ essentialTypes: ["venue"], confirmedVenueLocation: "Main Hall" })];

  it.each([
    ["AC1", "no check yet", [], "no-check"],
    ["AC2", "a rejection not yet resubmitted", [REJECTED], "rejected"],
    ["AC3", "a rejection resubmitted", [{ ...REJECTED, resubmittedAt: "2026-10-07T09:00:00.000Z" }], "awaiting-recheck"],
  ] as const)("%s: reports %s as blocking confirmation", async (_ac, _label, checks, blocker) => {
    const useCase = buildUseCase([seedEvent()], ready(), AFTER_END, checks);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.confirmation).toBe("blocked");
    expect(result?.safetyCheckBlocker).toBe(blocker);
    expect(result?.blockingArrangements).toEqual([]);
  });

  it("AC4/AC5: reports ready once the latest check is Approved, even after an earlier rejection", async () => {
    const useCase = buildUseCase([seedEvent()], ready(), AFTER_END, [
      APPROVED,
      { ...REJECTED, resubmittedAt: "2026-10-05T09:00:00.000Z" },
    ]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.confirmation).toBe("ready");
    expect(result?.safetyCheckBlocker).toBeNull();
  });

  it("AC6: reports both the incomplete arrangement and the safety check", async () => {
    const useCase = buildUseCase([seedEvent()], [seedFacts({ essentialTypes: ["venue"] })], AFTER_END, []);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.confirmation).toBe("blocked");
    expect(result?.blockingArrangements).toEqual(["venue"]);
    expect(result?.safetyCheckBlocker).toBe("no-check");
  });
});

describe("ViewCoordinatorEventUseCase planning details (SPM-285)", () => {
  it("AC5: returns the venue requirements and source request the Venue tab shows", async () => {
    const useCase = buildUseCase([
      seedEvent({
        venueRequirements: "Stage and breakout rooms",
        roomLayoutPreference: "Theatre",
        accessibilityRequirements: "Step-free access",
        requiredFacilities: "Projector, Stage",
      }),
    ]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.details).toMatchObject({
      eventRequestId: "request-1",
      venueRequirements: "Stage and breakout rooms",
      roomLayoutPreference: "Theatre",
      accessibilityRequirements: "Step-free access",
      requiredFacilities: "Projector, Stage",
    });
  });
});

describe("ViewCoordinatorEventUseCase completion (SPM-51)", () => {
  const times = [{ date: "2026-10-14", start: "13:00", end: "18:00" }] as const;

  it("offers completion on a Confirmed event once its last slot has ended", async () => {
    const useCase = buildUseCase([seedEvent({ status: "Confirmed", times })]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.canComplete).toBe(true);
  });

  it("holds completion back before the last slot ends", async () => {
    const useCase = buildUseCase(
      [seedEvent({ status: "Confirmed", times })],
      [],
      new Date("2026-10-14T17:59:59+08:00"),
    );

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.canComplete).toBe(false);
  });

  it("does not offer completion on a Planning event, even after it would have ended", async () => {
    const useCase = buildUseCase([seedEvent({ status: "Planning", times })]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.canComplete).toBe(false);
  });
});

describe("ViewCoordinatorEventUseCase flags (SPM-313)", () => {
  const BLOCK = {
    venueId: venueId("venue-1"),
    startDate: "2026-11-06",
    endDate: "2026-11-06",
    slots: [{ date: "2026-11-06", slot: "PM" }],
    reason: "Maintenance",
    note: null,
  } as const;

  async function flaggedStore(): Promise<InMemoryVenueUnavailabilityRepository> {
    const flags = new InMemoryVenueUnavailabilityRepository(
      new FixedClock(AFTER_END),
      new Map([["venue-1", "Main Hall"]]),
      new Map(),
      [
        {
          id: "booking-1",
          venueId: "venue-1",
          eventName: "Tech Summit",
          status: "Confirmed",
          slots: [{ date: "2026-11-06", slot: "PM" }],
          eventId: "event-1",
          coordinatorUserAccountId: COORDINATOR,
        },
      ],
    );
    await flags.record(BLOCK, userAccountId("staff-1"));
    return flags;
  }

  it("AC4: gives the assigned coordinator each flagged booking with its reason, slots and flag time", async () => {
    const useCase = buildUseCase([seedEvent()], [], AFTER_END, [APPROVED], await flaggedStore());

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.flaggedBookings).toEqual([
      {
        flagId: "flag-1",
        bookingId: "booking-1",
        venueLocation: "Main Hall",
        status: "Confirmed",
        holdExpiresAt: null,
        bookedFor: "2026-11-06 13:00 to 18:00",
        reasonCode: "venue-unavailable",
        detail: "Maintenance: 2026-11-06 13:00 to 18:00",
        flaggedAt: AFTER_END.toISOString(),
        sourceLiftedAt: null,
      },
    ]);
  });

  it("AC3: leaves the booking's status as it was beside the flag", async () => {
    const useCase = buildUseCase([seedEvent()], [], AFTER_END, [APPROVED], await flaggedStore());

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.flaggedBookings.map((flag) => flag.status)).toEqual(["Confirmed"]);
  });

  it("AC4: gives an event with nothing flagged an empty list", async () => {
    const useCase = buildUseCase([seedEvent()]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.flaggedBookings).toEqual([]);
  });

  it("AC4: gives another coordinator no event, and so no flag", async () => {
    const useCase = buildUseCase([seedEvent()], [], AFTER_END, [APPROVED], await flaggedStore());

    await expect(
      useCase.execute({ id: "event-1", userAccountId: OTHER_COORDINATOR }),
    ).resolves.toBeNull();
  });
});

describe("ViewCoordinatorEventUseCase cancellation (SPM-55)", () => {
  it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Confirmed"])(
    "AC2: offers cancelling a %s event",
    async (status) => {
      const useCase = buildUseCase([seedEvent({ status })]);

      const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

      expect(result?.canCancel).toBe(true);
    },
  );

  it.each<CoordinatorEventStatus>(["Completed", "Cancelled"])(
    "AC2: does not offer cancelling a %s event",
    async (status) => {
      const useCase = buildUseCase([seedEvent({ status })]);

      const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

      expect(result?.canCancel).toBe(false);
    },
  );
});

describe("ViewCoordinatorEventUseCase essential equipment (SPM-318)", () => {
  const line = (equipmentType: string, quantityReserved: number) =>
    ({ equipmentType, state: quantityReserved > 0 ? "Reserved" : "Requested", quantityRequested: 2, quantityReserved }) as const;

  it("AC1: names each essential line blocking confirmation", async () => {
    const useCase = buildUseCase(
      [seedEvent()],
      [seedFacts({ essentialEquipment: [line("Projector", 2), line("PA speaker", 0)] })],
    );

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.confirmation).toBe("blocked");
    expect(result?.blockingEquipment).toEqual(["PA speaker"]);
  });

  it("AC2: says nothing about equipment when no essential line is short", async () => {
    const useCase = buildUseCase([seedEvent()], [seedFacts({ essentialEquipment: [line("Projector", 2)] })]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.blockingEquipment).toEqual([]);
  });
});

describe("ViewCoordinatorEventUseCase end time (SPM-326)", () => {
  it("AC3: gives the instant the event's latest end time passes", async () => {
    const useCase = buildUseCase([
      seedEvent({
        status: "Confirmed",
        times: [
          { date: "2026-10-14", start: "07:00", end: "12:00" },
          { date: "2026-10-14", start: "13:00", end: "18:15" },
        ],
      }),
    ]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.endsAt).toBe(new Date("2026-10-14T18:15:00+08:00").toISOString());
  });

  it("AC3: has no end time for an event with no times", async () => {
    const useCase = buildUseCase([seedEvent({ status: "Confirmed", times: [] })]);

    const result = await useCase.execute({ id: "event-1", userAccountId: COORDINATOR });

    expect(result?.endsAt).toBeNull();
  });
});
