import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryEquipmentCatalogue } from "@/adapters/outbound/in-memory/in-memory-equipment-catalogue";
import { equipmentItemId } from "@/core/domain/equipment-item";
import {
  EquipmentItemNotFoundError,
  EquipmentLocationRequiredError,
  InvalidEquipmentQuantityError,
  InvalidOutOfServiceCountError,
} from "@/core/domain/errors";

import { ListEquipmentCatalogueUseCase } from "./list-equipment-catalogue";
import { UpdateEquipmentStockUseCase } from "./update-equipment-stock";

const PROJECTOR = {
  type: "Projector (4K)",
  description: "Ceiling-mount capable",
  quantity: 6,
  location: "Store A",
  outOfService: 0,
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

    const result = await useCase.execute({ equipmentItemId: id, quantity: 4, location: "Store B", outOfService: 0 });

    expect(result).toEqual({ equipmentItemId: id, quantity: 4, location: "Store B", outOfService: 0 });
    await expect(equipment.findById(id)).resolves.toEqual({
      ...PROJECTOR,
      id,
      quantity: 4,
      location: "Store B",
    });
  });

  it("AC2: leaves the type and description untouched", async () => {
    const { useCase, equipment, id } = await build();

    await useCase.execute({ equipmentItemId: id, quantity: 1, location: "Loading bay", outOfService: 0 });

    await expect(equipment.findById(id)).resolves.toMatchObject({
      type: PROJECTOR.type,
      description: PROJECTOR.description,
    });
  });

  it("allows the quantity to drop to exactly zero (the boundary)", async () => {
    const { useCase, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: 0, location: "Store A", outOfService: 0 }),
    ).resolves.toMatchObject({ quantity: 0 });
  });

  it("refuses a negative quantity and keeps the stored record", async () => {
    const { useCase, equipment, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: -1, location: "Store B", outOfService: 0 }),
    ).rejects.toBeInstanceOf(InvalidEquipmentQuantityError);
    await expect(equipment.findById(id)).resolves.toMatchObject({ quantity: 6, location: "Store A" });
  });

  it("refuses a blank location and keeps the stored record", async () => {
    const { useCase, equipment, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: 2, location: "   ", outOfService: 0 }),
    ).rejects.toBeInstanceOf(EquipmentLocationRequiredError);
    await expect(equipment.findById(id)).resolves.toMatchObject({ quantity: 6, location: "Store A" });
  });

  it("throws EquipmentItemNotFoundError for a record that does not exist", async () => {
    const { useCase } = await build();

    await expect(
      useCase.execute({ equipmentItemId: "missing", quantity: 1, location: "Store A", outOfService: 0 }),
    ).rejects.toBeInstanceOf(EquipmentItemNotFoundError);
  });

  it("does not create a record when asked to update a missing one", async () => {
    const { useCase, equipment } = await build();

    await useCase
      .execute({ equipmentItemId: "missing", quantity: 1, location: "Store A", outOfService: 0 })
      .catch(() => undefined);

    await expect(equipment.findById(equipmentItemId("missing"))).resolves.toBeNull();
    await expect(equipment.list()).resolves.toHaveLength(1);
  });
});

describe("UpdateEquipmentStockUseCase (SPM-17)", () => {
  it("AC1: saves how many units are out of service", async () => {
    const { useCase, equipment, id } = await build();

    const result = await useCase.execute({ equipmentItemId: id, quantity: 6, location: "Store A", outOfService: 2 });

    expect(result.outOfService).toBe(2);
    await expect(equipment.findById(id)).resolves.toMatchObject({ quantity: 6, outOfService: 2 });
  });

  it("AC2: refuses more out of service than owned and saves nothing", async () => {
    const { useCase, equipment, id } = await build();

    await expect(
      useCase.execute({ equipmentItemId: id, quantity: 4, location: "Store B", outOfService: 5 }),
    ).rejects.toThrow(InvalidOutOfServiceCountError);
    await expect(equipment.findById(id)).resolves.toMatchObject({ quantity: 6, location: "Store A", outOfService: 0 });
  });

  it("AC3: the catalogue shows owned, out of service and in service", async () => {
    const { useCase, equipment, id } = await build();
    await useCase.execute({ equipmentItemId: id, quantity: 6, location: "Store A", outOfService: 2 });

    const { items } = await new ListEquipmentCatalogueUseCase({
      equipment,
      clock: new FixedClock(new Date("2026-11-10T00:00:00Z")),
    }).execute();

    expect(items).toEqual([expect.objectContaining({ id, quantity: 6, outOfService: 2, inService: 4 })]);
  });
});
