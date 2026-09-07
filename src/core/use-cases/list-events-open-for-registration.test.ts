import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryEventCatalogue } from "@/adapters/outbound/in-memory/in-memory-event-catalogue";
import { eventId, type Event } from "@/core/domain/event";

import { ListEventsOpenForRegistrationUseCase } from "./list-events-open-for-registration";

const NOW = new Date("2026-09-07T02:00:00.000Z"); // 10:00 in Singapore.
const OPENS = new Date("2026-09-01T00:00:00.000Z");
const CLOSES = new Date("2026-09-30T00:00:00.000Z");

function event(id: string, overrides: Partial<Event> = {}): Event {
  return {
    id: eventId(id),
    name: `Event ${id}`,
    description: "A confirmed event with registration open.",
    status: "confirmed",
    startsAt: new Date("2026-10-01T01:00:00.000Z"),
    endsAt: new Date("2026-10-01T09:00:00.000Z"),
    venueName: "Hall A, 81 Victoria Street",
    capacity: 100,
    registrationEnabled: true,
    registrationOpensAt: OPENS,
    registrationClosesAt: CLOSES,
    ...overrides,
  };
}

function buildUseCase(seed: readonly Event[], now: Date = NOW) {
  return new ListEventsOpenForRegistrationUseCase({
    events: new InMemoryEventCatalogue(seed),
    clock: new FixedClock(now),
  });
}

async function listedIds(
  seed: readonly Event[],
  now: Date = NOW,
): Promise<string[]> {
  const { events } = await buildUseCase(seed, now).execute();
  return events.map((e) => e.id);
}

describe("ListEventsOpenForRegistrationUseCase", () => {
  it("lists a confirmed event whose registration is enabled and window is open", async () => {
    await expect(listedIds([event("summit")])).resolves.toEqual(["summit"]);
  });

  it.each([
    "planning",
    "blocked",
    "completed",
    "cancelled",
  ] as const)("omits an event whose status is %s", async (status) => {
    await expect(listedIds([event("summit", { status })])).resolves.toEqual([]);
  });

  it("omits a confirmed event whose registration is disabled", async () => {
    await expect(
      listedIds([event("summit", { registrationEnabled: false })]),
    ).resolves.toEqual([]);
  });

  it("omits a confirmed event before its registration window opens", async () => {
    const notYet = new Date("2026-08-31T23:59:59.999Z");
    await expect(listedIds([event("summit")], notYet)).resolves.toEqual([]);
  });

  it("omits a confirmed event after its registration window closes", async () => {
    const tooLate = new Date("2026-09-30T00:00:00.001Z");
    await expect(listedIds([event("summit")], tooLate)).resolves.toEqual([]);
  });

  it("omits a confirmed event with no registration window set", async () => {
    const unset = event("summit", {
      registrationOpensAt: null,
      registrationClosesAt: null,
    });
    await expect(listedIds([unset])).resolves.toEqual([]);
  });

  it("includes an event at the exact instant its window opens", async () => {
    await expect(listedIds([event("summit")], OPENS)).resolves.toEqual([
      "summit",
    ]);
  });

  it("includes an event at the exact instant its window closes", async () => {
    await expect(listedIds([event("summit")], CLOSES)).resolves.toEqual([
      "summit",
    ]);
  });

  it("returns the soonest event first", async () => {
    const later = event("later", {
      startsAt: new Date("2026-11-01T01:00:00.000Z"),
    });
    const sooner = event("sooner", {
      startsAt: new Date("2026-10-05T01:00:00.000Z"),
    });
    await expect(listedIds([later, sooner])).resolves.toEqual([
      "sooner",
      "later",
    ]);
  });

  it("returns an empty list when nothing is open", async () => {
    await expect(listedIds([])).resolves.toEqual([]);
  });

  it("returns plain data: string ids and ISO timestamps, no Date and no branded types", async () => {
    const { events } = await buildUseCase([event("summit")]).execute();

    expect(events).toEqual([
      {
        id: "summit",
        name: "Event summit",
        description: "A confirmed event with registration open.",
        startsAt: "2026-10-01T01:00:00.000Z",
        endsAt: "2026-10-01T09:00:00.000Z",
        venueName: "Hall A, 81 Victoria Street",
        registrationClosesAt: "2026-09-30T00:00:00.000Z",
      },
    ]);
  });
});
