import { describe, expect, it } from "vitest";

import { InMemoryEquipmentCatalogue } from "@/adapters/outbound/in-memory/in-memory-equipment-catalogue";
import {
  EquipmentLocationRequiredError,
  EquipmentTypeRequiredError,
  InvalidEquipmentQuantityError,
} from "@/core/domain/errors";

import { CreateEquipmentItemUseCase } from "./create-equipment-item";
import { ListEquipmentCatalogueUseCase } from "./list-equipment-catalogue";

function build() {
  const equipment = new InMemoryEquipmentCatalogue();
  return {
    equipment,
    create: new CreateEquipmentItemUseCase({ equipment }),
    list: new ListEquipmentCatalogueUseCase({ equipment }),
  };
}

const PROJECTOR = {
  type: "Projector (4K)",
  description: "Ceiling-mount capable",
  quantity: 6,
  location: "Store A",
};

describe("CreateEquipmentItemUseCase (SPM-40)", () => {
  it("AC1: creates a record with type, description, quantity and location", async () => {
    const { create, list } = build();

    const result = await create.execute(PROJECTOR);

    expect(result).toEqual({
      equipmentItemId: expect.any(String),
      type: "Projector (4K)",
      quantity: 6,
      location: "Store A",
    });
    const { items } = await list.execute();
    expect(items).toEqual([{ id: result.equipmentItemId, ...PROJECTOR }]);
  });

  it("AC4: the catalogue starts empty -- nothing is imported", async () => {
    const { list } = build();

    await expect(list.execute()).resolves.toEqual({ items: [] });
  });

  it("AC3: reports the quantity available, however units are held internally", async () => {
    const { create } = build();

    const result = await create.execute({ ...PROJECTOR, quantity: 24 });

    expect(result.quantity).toBe(24);
  });

  it("AC1: a record with no type is refused and nothing is stored", async () => {
    const { create, list } = build();

    await expect(create.execute({ ...PROJECTOR, type: "" })).rejects.toBeInstanceOf(
      EquipmentTypeRequiredError,
    );
    await expect(list.execute()).resolves.toEqual({ items: [] });
  });

  it("AC1: a record with no location is refused and nothing is stored", async () => {
    const { create, list } = build();

    await expect(create.execute({ ...PROJECTOR, location: "  " })).rejects.toBeInstanceOf(
      EquipmentLocationRequiredError,
    );
    await expect(list.execute()).resolves.toEqual({ items: [] });
  });

  it("a negative quantity is refused and nothing is stored", async () => {
    const { create, list } = build();

    await expect(create.execute({ ...PROJECTOR, quantity: -3 })).rejects.toBeInstanceOf(
      InvalidEquipmentQuantityError,
    );
    await expect(list.execute()).resolves.toEqual({ items: [] });
  });

  it("lists the catalogue ordered by type", async () => {
    const { create, list } = build();
    await create.execute({ ...PROJECTOR, type: "Wireless microphone" });
    await create.execute({ ...PROJECTOR, type: "Laptop (presenter)" });

    const { items } = await list.execute();

    expect(items.map((item) => item.type)).toEqual(["Laptop (presenter)", "Wireless microphone"]);
  });
});
