import { describe, expect, it } from "vitest";

import { InMemoryEquipmentCatalogue } from "@/adapters/outbound/in-memory/in-memory-equipment-catalogue";
import { equipmentItemId } from "@/core/domain/equipment-item";
import {
  EquipmentItemNotFoundError,
  EquipmentLocationRequiredError,
  InvalidEquipmentQuantityError,
} from "@/core/domain/errors";

import { UpdateEquipmentStockUseCase } from "./update-equipment-stock";

const PROJECTOR = {
  type: "Projector (4K)",
  description: "Ceiling-mount capable",
  quantity: 6,
  location: "Store A",
};

async function build() {
  const equipment = new InMemoryEquipmentCatalogue([PROJECTOR]);
  const [seeded] = await equipment.list();
  return {
    equipment,
    id: seeded.id,
    useCase: new UpdateEquipmentStockUseCase({ equipment }),
  };
}

describe("UpdateEquipmentStockUseCase (SPM-40)", () => {
  it("AC2: updates the quantity and location of an existing record", async () => {
    const { useCase, equipment, id } = await build();

    const result = await useCase.execute({ equipmentItemId: id, quantity: 4, location: "Store B" });

    expect(result).toEqual({ equipmentItemId: id, quantity: 4, location: "Store B" });
    await expect(equipment.findById(id)).resolves.toEqual({
      ...PROJECTOR,
      id,
      quantity: 4,
      location: "Store B",
    });
  });

  it("AC2: leaves the type and description untouched", async () => {
    const { useCase, equipment, id } = await build();

    await useCase.execute({ equipmentItemId: id, quantity: 1, location: "Loading bay" });

    await expect(equipment.findById(id)).resolves.toMatchObject({
      type: PROJECTOR.type,
      description: PROJECTOR.description,
    });
  });

  it("allows the quantity to drop to exactly zero (the boundary)", async () => {
    const { useCase, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: 0, location: "Store A" }),
    ).resolves.toMatchObject({ quantity: 0 });
  });

  it("refuses a negative quantity and keeps the stored record", async () => {
    const { useCase, equipment, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: -1, location: "Store B" }),
    ).rejects.toBeInstanceOf(InvalidEquipmentQuantityError);
    await expect(equipment.findById(id)).resolves.toMatchObject({ quantity: 6, location: "Store A" });
  });

  it("refuses a blank location and keeps the stored record", async () => {
    const { useCase, equipment, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: 2, location: "   " }),
    ).rejects.toBeInstanceOf(EquipmentLocationRequiredError);
    await expect(equipment.findById(id)).resolves.toMatchObject({ quantity: 6, location: "Store A" });
  });

  it("throws EquipmentItemNotFoundError for a record that does not exist", async () => {
    const { useCase } = await build();

    await expect(
      useCase.execute({ equipmentItemId: "missing", quantity: 1, location: "Store A" }),
    ).rejects.toBeInstanceOf(EquipmentItemNotFoundError);
  });

  it("does not create a record when asked to update a missing one", async () => {
    const { useCase, equipment } = await build();

    await useCase
      .execute({ equipmentItemId: "missing", quantity: 1, location: "Store A" })
      .catch(() => undefined);

    await expect(equipment.findById(equipmentItemId("missing"))).resolves.toBeNull();
    await expect(equipment.list()).resolves.toHaveLength(1);
  });
});
