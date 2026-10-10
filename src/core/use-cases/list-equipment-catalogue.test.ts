import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryEquipmentCatalogue } from "@/adapters/outbound/in-memory/in-memory-equipment-catalogue";
import type { EventReservation } from "@/core/domain/equipment-review";

import { ListEquipmentCatalogueUseCase } from "./list-equipment-catalogue";
import { UpdateEquipmentStockUseCase } from "./update-equipment-stock";

/** 10 November 2026, 1am in Singapore. */
const NOW = new Date("2026-11-09T17:00:00Z");

const LAPTOP = { type: "Presentation laptop", description: null, quantity: 8, location: "IT desk", outOfService: 0 };

function reservation(eventId: string, eventDate: string, quantityReserved: number): EventReservation {
  return { eventId, eventName: `Event ${eventId}`, eventStatus: "Planning", eventDate, quantityReserved };
}

async function build(reservations: readonly EventReservation[]) {
  const equipment = new InMemoryEquipmentCatalogue([LAPTOP], { "equipment-1": reservations });
  const list = () => new ListEquipmentCatalogueUseCase({ equipment, clock: new FixedClock(NOW) }).execute();
  const setOutOfService = (outOfService: number) =>
    new UpdateEquipmentStockUseCase({ equipment }).execute({
      equipmentItemId: "equipment-1",
      quantity: 8,
      location: "IT desk",
      outOfService,
    });
  return { list, setOutOfService };
}

describe("ListEquipmentCatalogueUseCase (SPM-274)", () => {
  it("AC7: after units go out of service, the card lists the days more are reserved than are in service", async () => {
    const { list, setOutOfService } = await build([reservation("A", "2026-11-20", 6), reservation("B", "2026-11-21", 2)]);

    await setOutOfService(1);

    const [item] = (await list()).items;
    expect(item?.inService).toBe(7);
    expect(item?.shortDays).toEqual([
      {
        from: "2026-11-20",
        to: "2026-11-20",
        reserved: 8,
        events: [
          { eventId: "A", eventName: "Event A", eventDate: "2026-11-20", quantityReserved: 6 },
          { eventId: "B", eventName: "Event B", eventDate: "2026-11-21", quantityReserved: 2 },
        ],
      },
    ]);
  });

  it("AC7: lists them every time the catalogue is read, not only straight after a save", async () => {
    const { list, setOutOfService } = await build([reservation("A", "2026-11-20", 6), reservation("B", "2026-11-21", 2)]);
    await setOutOfService(1);

    await list();

    expect((await list()).items[0]?.shortDays).toHaveLength(1);
  });

  it("AC7: lists none while what is in service covers every day", async () => {
    const { list } = await build([reservation("A", "2026-11-20", 6), reservation("B", "2026-11-21", 2)]);

    expect((await list()).items[0]?.shortDays).toEqual([]);
  });

  it("AC7: judges which days are upcoming by today's date in Singapore", async () => {
    const { list, setOutOfService } = await build([reservation("today", "2026-11-10", 1)]);
    await setOutOfService(8);

    // Its units are collected on 9 Nov -- still today in UTC, but yesterday in Singapore.
    expect((await list()).items[0]?.shortDays.map((run) => [run.from, run.to])).toEqual([["2026-11-10", "2026-11-10"]]);
  });
});
