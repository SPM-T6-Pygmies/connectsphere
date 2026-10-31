import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  COORDINATOR,
  line,
  OTHER_COORDINATOR,
  PROJECTOR,
  seedEvent,
  watchEquipmentForSafety,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import { CoordinatorEventNotFoundError } from "@/core/domain/errors";

import { UndoEquipmentRemovalUseCase } from "./undo-equipment-removal";

const pendingRemoval = {
  "event-1": {
    reservation: { id: "reservation-10", reviewerUserAccountId: null },
    lines: [
      line({
        equipmentItemId: PROJECTOR,
        quantityRequested: 2,
        quantityReserved: 2,
        state: "Under review",
        removalRequested: true,
      }),
    ],
  },
};

function undo(deps = buildEquipmentDeps([seedEvent()], pendingRemoval)) {
  return { ...deps, useCase: new UndoEquipmentRemovalUseCase(deps) };
}

const base = { eventId: "event-1", userAccountId: COORDINATOR, equipmentItemId: PROJECTOR };

describe("UndoEquipmentRemovalUseCase (SPM-184)", () => {
  it("withdraws the request and returns the line to Reserved when nothing else differs", async () => {
    const { useCase, equipment } = undo();

    const change = await useCase.execute(base);

    expect(change).toMatchObject({
      action: "removalUndone",
      quantityBefore: 2,
      quantityAfter: 2,
      underReview: false,
      reviewCleared: true,
    });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      quantityReserved: 2,
      removalRequested: false,
      state: "Reserved",
      reviewBaseline: null,
    });
  });

  it("withdraws the request but keeps the line under review when it was also changed", async () => {
    const changedThenRemoved = {
      "event-1": {
        reservation: { id: "reservation-10", reviewerUserAccountId: null },
        lines: [
          line({
            equipmentItemId: PROJECTOR,
            quantityRequested: 3,
            quantityReserved: 2,
            state: "Under review",
            reviewBaseline: { quantityRequested: 2, technicalRequirements: null },
            removalRequested: true,
          }),
        ],
      },
    };
    const { useCase, equipment } = undo(buildEquipmentDeps([seedEvent()], changedThenRemoved));

    const change = await useCase.execute(base);

    expect(change).toMatchObject({ underReview: true, reviewCleared: false });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      quantityRequested: 3,
      removalRequested: false,
      state: "Under review",
      reviewBaseline: { quantityRequested: 2, technicalRequirements: null },
    });
  });

  it("answers not-found to a coordinator the event is not assigned to, and changes nothing", async () => {
    const { useCase, equipment } = undo();

    await expect(useCase.execute({ ...base, userAccountId: OTHER_COORDINATOR })).rejects.toThrow(
      CoordinatorEventNotFoundError,
    );
    expect(equipment.stored("event-1")).toEqual(pendingRemoval["event-1"]);
  });
});

describe("UndoEquipmentRemovalUseCase telling Safety Officers (SPM-262)", () => {
  it("AC2: undoing a removal that returns the line to Reserved tells every Safety Officer", async () => {
    const deps = buildEquipmentDeps([seedEvent()], pendingRemoval);
    watchEquipmentForSafety(deps);
    const { useCase, notifier } = undo(deps);

    await useCase.execute(base);

    expect(notifier.safetyChecksReady.map((notice) => notice.recipientUserAccountId)).toEqual(["safety-1", "safety-2"]);
  });
});

describe("UndoEquipmentRemovalUseCase telling Technical Support (SPM-64)", () => {
  it("AC1, AC2: withdrawing a removal request tells every member the reservation stands", async () => {
    const { useCase, notifier } = undo();

    await useCase.execute(base);

    expect(notifier.equipmentNeedingAttention).toEqual(
      ["support-1", "support-2"].map((recipientUserAccountId) => ({
        recipientUserAccountId,
        eventId: "event-1",
        eventName: "Founders' Gala Dinner",
        preferredDate: "2026-12-12",
        equipmentType: "Projector",
        change: "removalWithdrawn",
        quantityRequested: 2,
        quantityWas: null,
        attention: null,
      })),
    );
  });

  it("AC2: withdrawing it from a line also changed says the line still needs re-review", async () => {
    const changedThenRemoved = {
      "event-1": {
        reservation: { id: "reservation-10", reviewerUserAccountId: null },
        lines: [
          line({
            equipmentItemId: PROJECTOR,
            quantityRequested: 3,
            quantityReserved: 2,
            state: "Under review",
            reviewBaseline: { quantityRequested: 2, technicalRequirements: null },
            removalRequested: true,
          }),
        ],
      },
    };
    const { useCase, notifier } = undo(buildEquipmentDeps([seedEvent()], changedThenRemoved));

    await useCase.execute(base);

    expect(notifier.equipmentNeedingAttention.map(({ attention }) => attention)).toEqual(["changed", "changed"]);
  });

  it("AC3: a refused undo tells no one", async () => {
    const { useCase, notifier } = undo();

    await expect(useCase.execute({ ...base, userAccountId: OTHER_COORDINATOR })).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(notifier.equipmentNeedingAttention).toEqual([]);
  });
});
