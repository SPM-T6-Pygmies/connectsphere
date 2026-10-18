import { describe, expect, it, vi } from "vitest";

import { InMemoryEquipmentNoticeDirectory } from "@/adapters/outbound/in-memory/in-memory-equipment-notice-directory";
import { InMemoryTechnicalEquipmentRepository } from "@/adapters/outbound/in-memory/in-memory-technical-equipment-repository";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { EventDateRequiredForEquipmentError, NotEnoughEquipmentAvailableError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
import type { EventEquipmentStock } from "@/core/ports/outbound/technical-equipment-repository";

import { EquipmentOutcomeAnnouncer } from "./announce-equipment-outcome";
import { ListEquipmentQueueUseCase } from "./list-equipment-queue";
import { ReserveEquipmentLineUseCase } from "./reserve-equipment-line";
import { ViewEventEquipmentForTechnicalSupportUseCase } from "./view-event-equipment-for-technical-support";

const SUPPORT = "support-1";
const OTHER_SUPPORT = "support-2";

/** A New projector line for `quantityRequested`, of 10 owned. */
function projector(quantityRequested: number, overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId("item-projector"),
    quantityRequested,
    technicalRequirements: null,
    quantityReserved: 0,
    state: "Requested",
    reviewBaseline: null,
    removalRequested: false,
    decision: null,
    ...overrides,
  };
}

function event(
  id: string,
  preferredDate: string | null,
  lines: readonly EquipmentRequirement[],
  status: CoordinatorEventStatus = "Planning",
): EventEquipmentStock {
  return {
    event: { id: eventId(id), name: `Event ${id}`, status, preferredDate },
    lines: lines.map((line) => ({
      line,
      equipmentType: line.equipmentItemId === "item-projector" ? "Projector" : "Lectern",
      owned: 10,
      outOfService: 0,
      otherHolds: [],
      decidedByName: null,
    })),
  };
}

/** Every seeded event belongs to coordinator-1; reviewers are named as the real store would read them back. */
function setup(seed: readonly EventEquipmentStock[]) {
  const equipment = new InMemoryTechnicalEquipmentRepository(seed, {
    [SUPPORT]: "Test Support Staff",
    [OTHER_SUPPORT]: "Test Support Staff 2",
  });
  const notifier = new RecordingNotifier();
  const outcome = new EquipmentOutcomeAnnouncer({
    equipment,
    directory: new InMemoryEquipmentNoticeDirectory([], Object.fromEntries(seed.map(({ event }) => [event.id, "coordinator-1"]))),
    notifier,
  });
  const reserve = (id: string, by = SUPPORT, item = "item-projector") =>
    new ReserveEquipmentLineUseCase({ equipment, outcome }).execute({ eventId: id, equipmentItemId: item, userAccountId: by });
  const view = (id: string) =>
    new ViewEventEquipmentForTechnicalSupportUseCase({ equipment }).execute({ eventId: id, userAccountId: SUPPORT });
  const needsReview = async () =>
    (await new ListEquipmentQueueUseCase({ equipment }).execute({ userAccountId: SUPPORT, queue: "needsReview" })).events.map(
      (entry) => entry.eventId,
    );
  return { equipment, notifier, reserve, view, needsReview };
}

describe("ReserveEquipmentLineUseCase (SPM-274)", () => {
  it("AC1: reserves the full quantity requested and records who reserved it", async () => {
    const { equipment, reserve } = setup([event("A", "2026-11-15", [projector(4)])]);

    expect(await reserve("A")).toEqual({
      eventId: "A",
      equipmentItemId: "item-projector",
      equipmentType: "Projector",
      state: "Reserved",
      quantityReserved: 4,
    });
    const stored = await equipment.eventEquipment(userAccountId(SUPPORT), eventId("A"));
    expect(stored?.lines[0]?.line.decision).toEqual({ by: SUPPORT, comment: null });
  });

  it("AC1: the reserved line no longer needs attention, and the event leaves Needs review", async () => {
    const { reserve, view, needsReview } = setup([event("A", "2026-11-15", [projector(4)])]);

    await reserve("A");

    expect((await view("A"))?.lines[0]).toMatchObject({ attention: null, quantityReserved: 4 });
    expect(await needsReview()).toEqual([]);
  });

  it("AC2: refuses an event with no date, reserving nothing", async () => {
    const { reserve, view } = setup([event("A", null, [projector(4)])]);

    await expect(reserve("A")).rejects.toThrow(EventDateRequiredForEquipmentError);
    expect((await view("A"))?.lines[0]).toMatchObject({ attention: "new", quantityReserved: 0 });
  });

  it("AC3: refuses when fewer are free than requested, reserving none of them", async () => {
    const { reserve, view } = setup([
      event("held", "2026-11-14", [projector(7, { quantityReserved: 7, state: "Reserved" })]),
      event("A", "2026-11-15", [projector(4)]),
    ]);

    await expect(reserve("A")).rejects.toThrow(NotEnoughEquipmentAvailableError);
    expect((await view("A"))?.lines[0]).toMatchObject({ attention: "new", quantityReserved: 0, available: 3 });
  });

  it("AC5: units reserved for one event are no longer available to another the same day, or a day either side", async () => {
    const { reserve, view } = setup([
      event("A", "2026-11-15", [projector(4)]),
      event("same day", "2026-11-15", [projector(1)]),
      event("day after", "2026-11-16", [projector(1)]),
      event("two days on", "2026-11-17", [projector(1)]),
    ]);

    await reserve("A");

    expect((await view("same day"))?.lines[0]?.available).toBe(6);
    expect((await view("day after"))?.lines[0]?.available).toBe(6);
    expect((await view("two days on"))?.lines[0]?.available).toBe(10);
  });

  it("AC5: a second event cannot then reserve more than what is left", async () => {
    const { reserve } = setup([event("A", "2026-11-15", [projector(6)]), event("B", "2026-11-15", [projector(5)])]);

    await reserve("A");

    await expect(reserve("B")).rejects.toThrow(NotEnoughEquipmentAvailableError);
  });

  it("AC6: re-checks what is free when reserving, refusing if another reservation took the units since the page was read", async () => {
    const { equipment, reserve } = setup([
      event("A", "2026-11-15", [projector(6)]),
      event("B", "2026-11-15", [projector(5)]),
    ]);
    const openedBeforeA = await equipment.eventEquipment(userAccountId(OTHER_SUPPORT), eventId("B"));

    await reserve("A");
    vi.spyOn(equipment, "eventEquipment").mockResolvedValueOnce(openedBeforeA);

    await expect(reserve("B", OTHER_SUPPORT)).rejects.toThrow(NotEnoughEquipmentAvailableError);
  });

  it("AC4: reserves a line marked unfulfilled once the coordinator has changed it", async () => {
    const changed = projector(3, {
      state: "Under review",
      reviewBaseline: { quantityRequested: 12, technicalRequirements: null },
      decision: { by: userAccountId(OTHER_SUPPORT), comment: "only 10 owned" },
    });
    const { reserve, view } = setup([event("A", "2026-11-15", [changed])]);
    expect((await view("A"))?.lines[0]?.attention).toBe("changed");

    expect(await reserve("A")).toMatchObject({ state: "Reserved", quantityReserved: 3 });
    expect((await view("A"))?.lines[0]?.attention).toBeNull();
  });
});

describe("ReserveEquipmentLineUseCase (SPM-275)", () => {
  it("AC1: reserves for an event between two others that are never out on the same day", async () => {
    const { reserve } = setup([
      event("day before", "2026-11-14", [projector(6)]),
      event("day after", "2026-11-16", [projector(6)]),
      event("B", "2026-11-15", [projector(4)]),
    ]);
    await reserve("day before");
    await reserve("day after");

    expect(await reserve("B")).toMatchObject({ state: "Reserved", quantityReserved: 4 });
  });
});

describe("ReserveEquipmentLineUseCase telling the coordinator (SPM-65)", () => {
  const lectern = (quantityRequested: number) => projector(quantityRequested, { equipmentItemId: equipmentItemId("item-lectern") });

  it("AC1: reserving the last line needing attention tells the assigned coordinator every line's outcome", async () => {
    const { reserve, notifier } = setup([event("A", "2026-11-15", [projector(4), lectern(1)])]);
    await reserve("A");

    await reserve("A", OTHER_SUPPORT, "item-lectern");

    expect(notifier.equipmentDecisions).toEqual([
      {
        recipientUserAccountId: "coordinator-1",
        eventId: "A",
        eventName: "Event A",
        preferredDate: "2026-11-15",
        lines: [
          {
            equipmentType: "Projector",
            quantityRequested: 4,
            outcome: "reserved",
            quantityReserved: 4,
            decidedByName: "Test Support Staff",
            comment: null,
          },
          {
            equipmentType: "Lectern",
            quantityRequested: 1,
            outcome: "reserved",
            quantityReserved: 1,
            decidedByName: "Test Support Staff 2",
            comment: null,
          },
        ],
      },
    ]);
  });

  it("AC2: reserving while another line still needs attention tells no one", async () => {
    const { reserve, notifier } = setup([event("A", "2026-11-15", [projector(4), lectern(1)])]);

    await reserve("A");

    expect(notifier.equipmentDecisions).toEqual([]);
  });

  it("AC2: a refused reservation tells no one", async () => {
    const { reserve, notifier } = setup([event("A", "2026-11-15", [projector(11)])]);

    await expect(reserve("A")).rejects.toThrow(NotEnoughEquipmentAvailableError);
    expect(notifier.equipmentDecisions).toEqual([]);
  });

  it("AC4: an event with no assigned coordinator tells no one", async () => {
    const equipment = new InMemoryTechnicalEquipmentRepository([event("A", "2026-11-15", [projector(4)])]);
    const notifier = new RecordingNotifier();
    const outcome = new EquipmentOutcomeAnnouncer({ equipment, directory: new InMemoryEquipmentNoticeDirectory(), notifier });

    await new ReserveEquipmentLineUseCase({ equipment, outcome }).execute({
      eventId: "A",
      equipmentItemId: "item-projector",
      userAccountId: SUPPORT,
    });

    expect(notifier.equipmentDecisions).toEqual([]);
  });
});
