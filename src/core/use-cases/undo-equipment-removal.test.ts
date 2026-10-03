import { describe, expect, it } from "vitest";

import {
  buildEquipmentDeps,
  COORDINATOR,
  line,
  OTHER_COORDINATOR,
  PROJECTOR,
  seedEvent,
} from "@/adapters/outbound/in-memory/equipment-fixture";
import { EventNotFoundError } from "@/core/domain/errors";

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
      EventNotFoundError,
    );
    expect(equipment.stored("event-1")).toEqual(pendingRemoval["event-1"]);
  });
});
