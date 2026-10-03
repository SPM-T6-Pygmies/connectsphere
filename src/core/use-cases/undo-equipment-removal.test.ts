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
  it("keeps the line, still under review", async () => {
    const { useCase, equipment } = undo();

    const change = await useCase.execute(base);

    expect(change).toMatchObject({ action: "removalUndone", quantityBefore: 2, quantityAfter: 2 });
    expect(equipment.stored("event-1").lines[0]).toMatchObject({
      quantityReserved: 2,
      removalRequested: false,
      state: "Under review",
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
