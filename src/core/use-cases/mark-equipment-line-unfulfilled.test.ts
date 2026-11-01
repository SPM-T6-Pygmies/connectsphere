import { describe, expect, it } from "vitest";

import { InMemoryEquipmentNoticeDirectory } from "@/adapters/outbound/in-memory/in-memory-equipment-notice-directory";
import { InMemoryTechnicalEquipmentRepository } from "@/adapters/outbound/in-memory/in-memory-technical-equipment-repository";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { equipmentItemId } from "@/core/domain/equipment-item";
import type { EquipmentRequirement } from "@/core/domain/equipment-requirement";
import {
  EquipmentAvailableToReserveError,
  EventDateRequiredForEquipmentError,
  UnfulfilledCommentRequiredError,
} from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
import type { EventEquipmentStock } from "@/core/ports/outbound/technical-equipment-repository";

import { EquipmentOutcomeAnnouncer } from "./announce-equipment-outcome";
import { ListEquipmentQueueUseCase } from "./list-equipment-queue";
import { MarkEquipmentLineUnfulfilledUseCase } from "./mark-equipment-line-unfulfilled";
import { ReserveEquipmentLineUseCase } from "./reserve-equipment-line";

const SUPPORT = "support-1";

function newLine(item: string, quantityRequested: number): EquipmentRequirement {
  return {
    equipmentItemId: equipmentItemId(item),
    quantityRequested,
    technicalRequirements: null,
    quantityReserved: 0,
    state: "Requested",
    reviewBaseline: null,
    removalRequested: false,
    rescheduled: false,
    decision: null,
    essential: false,
  };
}

/** Event A, with a projector line for 5 of the 3 owned and a lectern line for 1 of the 3 owned. */
function setup(preferredDate: string | null = "2026-11-15") {
  const seed: EventEquipmentStock = {
    event: { id: eventId("A"), name: "Event A", status: "Planning", preferredDate },
    lines: [
      {
        line: newLine("item-projector", 5),
        equipmentType: "Projector",
        owned: 3,
        outOfService: 0,
        otherHolds: [],
        decidedByName: null,
      },
      { line: newLine("item-lectern", 1), equipmentType: "Lectern", owned: 3, outOfService: 0, otherHolds: [], decidedByName: null },
    ],
  };
  const equipment = new InMemoryTechnicalEquipmentRepository([seed], { [SUPPORT]: "Test Support Staff" });
  const notifier = new RecordingNotifier();
  const outcome = new EquipmentOutcomeAnnouncer({
    equipment,
    directory: new InMemoryEquipmentNoticeDirectory([], { A: "coordinator-1" }),
    notifier,
  });
  const mark = (item: string, comment = "only 3 available") =>
    new MarkEquipmentLineUnfulfilledUseCase({ equipment, outcome }).execute({
      eventId: "A",
      equipmentItemId: item,
      userAccountId: SUPPORT,
      comment,
    });
  const stored = async () => (await equipment.eventEquipment(userAccountId(SUPPORT), eventId("A")))?.lines ?? [];
  return { equipment, notifier, mark, stored };
}

describe("MarkEquipmentLineUnfulfilledUseCase (SPM-274)", () => {
  it("AC3: marks the line unfulfilled with the comment and who marked it, reserving nothing", async () => {
    const { mark, stored } = setup();

    expect(await mark("item-projector")).toEqual({
      eventId: "A",
      equipmentItemId: "item-projector",
      equipmentType: "Projector",
      state: "Unfulfilled",
      quantityReserved: 0,
    });
    expect((await stored())[0]?.line).toMatchObject({
      state: "Unfulfilled",
      quantityReserved: 0,
      decision: { by: SUPPORT, comment: "only 3 available" },
    });
  });

  it("AC3: leaves the event's other lines as they were", async () => {
    const { mark, stored } = setup();

    await mark("item-projector");

    expect((await stored())[1]?.line).toEqual(newLine("item-lectern", 1));
  });

  it("AC3: the unfulfilled line no longer counts as needing attention", async () => {
    const { equipment, mark } = setup();
    const needsReview = () =>
      new ListEquipmentQueueUseCase({ equipment }).execute({ userAccountId: SUPPORT, queue: "needsReview" });

    await mark("item-projector");
    expect((await needsReview()).events[0]?.linesNeedingAttention).toBe(1);
  });

  it("AC3: refuses while enough are free to reserve the line, storing nothing", async () => {
    const { mark, stored } = setup();

    await expect(mark("item-lectern", "none spare")).rejects.toThrow(EquipmentAvailableToReserveError);
    expect((await stored())[1]?.line.state).toBe("Requested");
  });

  it("AC3: refuses without a comment", async () => {
    const { mark, stored } = setup();

    await expect(mark("item-projector", "  ")).rejects.toThrow(UnfulfilledCommentRequiredError);
    expect((await stored())[0]?.line.state).toBe("Requested");
  });

  it("AC2: refuses an event with no date", async () => {
    const { mark } = setup(null);

    await expect(mark("item-projector")).rejects.toThrow(EventDateRequiredForEquipmentError);
  });
});

describe("MarkEquipmentLineUnfulfilledUseCase (SPM-316)", () => {
  it("AC2: marking a changed reserved line unfulfilled releases what it held to other events at once", async () => {
    const stock = (line: EquipmentRequirement) => ({
      line,
      equipmentType: "Projector",
      owned: 10,
      outOfService: 0,
      otherHolds: [],
      decidedByName: null,
    });
    const raised: EquipmentRequirement = {
      ...newLine("item-projector", 7),
      quantityReserved: 4,
      state: "Under review",
      reviewBaseline: { quantityRequested: 4, technicalRequirements: null },
    };
    const equipment = new InMemoryTechnicalEquipmentRepository(
      [
        { event: { id: eventId("A"), name: "Event A", status: "Planning", preferredDate: "2026-11-15" }, lines: [stock(raised)] },
        {
          event: { id: eventId("held"), name: "Held", status: "Planning", preferredDate: "2026-11-15" },
          lines: [stock({ ...newLine("item-projector", 4), quantityReserved: 4, state: "Reserved" })],
        },
        {
          event: { id: eventId("B"), name: "Event B", status: "Planning", preferredDate: "2026-11-15" },
          lines: [stock(newLine("item-projector", 6))],
        },
      ],
      { [SUPPORT]: "Test Support Staff" },
    );
    const outcome = new EquipmentOutcomeAnnouncer({
      equipment,
      directory: new InMemoryEquipmentNoticeDirectory([], { A: "coordinator-1" }),
      notifier: new RecordingNotifier(),
    });
    const lineOf = async (id: string) =>
      (await equipment.eventEquipment(userAccountId(SUPPORT), eventId(id)))?.lines[0]?.line;

    await new MarkEquipmentLineUnfulfilledUseCase({ equipment, outcome }).execute({
      eventId: "A",
      equipmentItemId: "item-projector",
      userAccountId: SUPPORT,
      comment: "only 6 available",
    });

    expect(await lineOf("A")).toMatchObject({ state: "Unfulfilled", quantityReserved: 0 });
    await new ReserveEquipmentLineUseCase({ equipment, outcome }).execute({
      eventId: "B",
      equipmentItemId: "item-projector",
      userAccountId: SUPPORT,
    });
    expect(await lineOf("B")).toMatchObject({ state: "Reserved", quantityReserved: 6 });
  });
});

describe("MarkEquipmentLineUnfulfilledUseCase telling the coordinator (SPM-65)", () => {
  it("AC3: one notice lists every line, reserved or unfulfilled, with the comment and who decided", async () => {
    const { equipment, notifier, mark } = setup();
    const outcome = new EquipmentOutcomeAnnouncer({
      equipment,
      directory: new InMemoryEquipmentNoticeDirectory([], { A: "coordinator-1" }),
      notifier,
    });
    await new ReserveEquipmentLineUseCase({ equipment, outcome }).execute({
      eventId: "A",
      equipmentItemId: "item-lectern",
      userAccountId: SUPPORT,
    });
    expect(notifier.equipmentDecisions).toEqual([]);

    await mark("item-projector");

    expect(notifier.equipmentDecisions).toEqual([
      {
        recipientUserAccountId: "coordinator-1",
        eventId: "A",
        eventName: "Event A",
        preferredDate: "2026-11-15",
        lines: [
          {
            equipmentType: "Projector",
            quantityRequested: 5,
            outcome: "unfulfilled",
            quantityReserved: 0,
            decidedByName: "Test Support Staff",
            comment: "only 3 available",
          },
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

  it("AC2: marking while another line still needs attention tells no one", async () => {
    const { notifier, mark } = setup();

    await mark("item-projector");

    expect(notifier.equipmentDecisions).toEqual([]);
  });
});
