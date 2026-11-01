import { describe, expect, it } from "vitest";

import { InMemoryEquipmentNoticeDirectory } from "@/adapters/outbound/in-memory/in-memory-equipment-notice-directory";
import { InMemoryTechnicalEquipmentRepository } from "@/adapters/outbound/in-memory/in-memory-technical-equipment-repository";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import { EquipmentNothingToReleaseError } from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";
import { eventId } from "@/core/domain/event";
import type { EventEquipmentStock } from "@/core/ports/outbound/technical-equipment-repository";

import { EquipmentOutcomeAnnouncer } from "./announce-equipment-outcome";
import { ListEquipmentQueueUseCase } from "./list-equipment-queue";
import { ReleaseEquipmentLineUseCase } from "./release-equipment-line";
import { ViewEventEquipmentForTechnicalSupportUseCase } from "./view-event-equipment-for-technical-support";

const SUPPORT = "support-1";
const RESERVED_BY = { by: userAccountId(SUPPORT), comment: null };

/** A projector line for 4, all 4 reserved, of 10 owned. */
function projector(overrides: Partial<EquipmentRequirement> = {}): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId("item-projector"),
    quantityRequested: 4,
    technicalRequirements: null,
    quantityReserved: 4,
    state: "Reserved",
    reviewBaseline: null,
    removalRequested: false,
    rescheduled: false,
    decision: RESERVED_BY,
    essential: false,
    ...overrides,
  };
}

/** The projector line once the coordinator asked to remove it (SPM-41 AC11). */
const removalRequested = () =>
  projector({
    state: "Under review",
    reviewBaseline: { quantityRequested: 4, technicalRequirements: null },
    removalRequested: true,
  });

/** A lectern line for 1, reserved. */
const lectern = (overrides: Partial<EquipmentRequirement> = {}) =>
  projector({ equipmentItemId: equipmentItemId("item-lectern"), quantityRequested: 1, quantityReserved: 1, ...overrides });

function event(
  id: string,
  preferredDate: string,
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
      decidedByName: "Test Support Staff",
    })),
  };
}

/** Every seeded event belongs to coordinator-1. */
function setup(seed: readonly EventEquipmentStock[]) {
  const equipment = new InMemoryTechnicalEquipmentRepository(seed, { [SUPPORT]: "Test Support Staff" });
  const notifier = new RecordingNotifier();
  const outcome = new EquipmentOutcomeAnnouncer({
    equipment,
    directory: new InMemoryEquipmentNoticeDirectory([], Object.fromEntries(seed.map(({ event }) => [event.id, "coordinator-1"]))),
    notifier,
  });
  const release = (id: string, item = "item-projector") =>
    new ReleaseEquipmentLineUseCase({ equipment, outcome }).execute({
      eventId: id,
      equipmentItemId: item,
      userAccountId: SUPPORT,
    });
  const view = (id: string) =>
    new ViewEventEquipmentForTechnicalSupportUseCase({ equipment }).execute({ eventId: id, userAccountId: SUPPORT });
  const needsReview = async () =>
    (await new ListEquipmentQueueUseCase({ equipment }).execute({ userAccountId: SUPPORT, queue: "needsReview" })).events.map(
      (entry) => entry.eventId,
    );
  return { notifier, release, view, needsReview };
}

describe("ReleaseEquipmentLineUseCase (SPM-108)", () => {
  it("AC1: releases the line, which goes from the event", async () => {
    const { release, view } = setup([event("A", "2026-11-15", [lectern(), removalRequested()])]);

    expect(await release("A")).toEqual({
      eventId: "A",
      equipmentItemId: "item-projector",
      equipmentType: "Projector",
      state: "Released",
      quantityReleased: 4,
    });
    expect((await view("A"))?.lines.map((line) => line.equipmentType)).toEqual(["Lectern"]);
  });

  it("AC1: the event leaves Needs review once nothing else on it needs attention", async () => {
    const { release, needsReview } = setup([event("A", "2026-11-15", [lectern(), removalRequested()])]);
    expect(await needsReview()).toEqual(["A"]);

    await release("A");

    expect(await needsReview()).toEqual([]);
  });

  it("AC1: leaves the event's other lines as they were", async () => {
    const lecternRemovalRequested = lectern({
      state: "Under review",
      reviewBaseline: { quantityRequested: 1, technicalRequirements: null },
      removalRequested: true,
    });
    const { release, view } = setup([event("A", "2026-11-15", [lecternRemovalRequested, removalRequested()])]);

    await release("A");

    expect((await view("A"))?.lines).toMatchObject([
      { equipmentType: "Lectern", attention: "removalRequested", quantityReserved: 1 },
    ]);
  });

  it("AC2: the released units are available again to another event on those dates", async () => {
    const { release, view } = setup([
      event("A", "2026-11-15", [removalRequested()]),
      event("B", "2026-11-16", [projector({ quantityRequested: 8, quantityReserved: 0, state: "Requested", decision: null })]),
    ]);
    expect((await view("B"))?.lines[0]?.available).toBe(6);

    await release("A");

    expect((await view("B"))?.lines[0]?.available).toBe(10);
  });

  it("AC3: refuses once the coordinator withdrew the removal request, keeping what is held", async () => {
    const withdrawn = projector();
    const { release, view } = setup([event("A", "2026-11-15", [withdrawn])]);

    await expect(release("A")).rejects.toThrow(EquipmentNothingToReleaseError);
    expect((await view("A"))?.lines[0]).toMatchObject({ state: "Reserved", quantityReserved: 4 });
  });

  it("AC3: refuses a line released already, from another tab", async () => {
    const { release } = setup([event("A", "2026-11-15", [removalRequested()])]);
    await release("A");

    await expect(release("A")).rejects.toThrow(EquipmentNothingToReleaseError);
  });

  it("AC1: refuses on a Cancelled event, keeping the line", async () => {
    const { release, view } = setup([event("A", "2026-11-15", [removalRequested()], "Cancelled")]);

    await expect(release("A")).rejects.toThrow(EquipmentNothingToReleaseError);
    expect((await view("A"))?.lines).toHaveLength(1);
  });

  it("AC1: releasing the last line needing attention tells the coordinator the outcome of the rest", async () => {
    const { notifier, release } = setup([event("A", "2026-11-15", [lectern(), removalRequested()])]);

    await release("A");

    expect(notifier.equipmentDecisions).toEqual([
      {
        recipientUserAccountId: "coordinator-1",
        eventId: "A",
        eventName: "Event A",
        preferredDate: "2026-11-15",
        lines: [
          {
            equipmentType: "Lectern",
            quantityRequested: 1,
            outcome: "reserved",
            quantityReserved: 1,
            decidedByName: "Test Support Staff",
            comment: null,
          },
        ],
      },
    ]);
  });

  it("AC1: releasing the event's only line tells no one, as no outcome is left", async () => {
    const { notifier, release } = setup([event("A", "2026-11-15", [removalRequested()])]);

    await release("A");

    expect(notifier.equipmentDecisions).toEqual([]);
  });

  it("AC1: releasing while another line still needs attention tells no one", async () => {
    const { notifier, release } = setup([
      event("A", "2026-11-15", [lectern({ quantityReserved: 0, state: "Requested", decision: null }), removalRequested()]),
    ]);

    await release("A");

    expect(notifier.equipmentDecisions).toEqual([]);
  });
});
