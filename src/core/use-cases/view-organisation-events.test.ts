import { describe, expect, it } from "vitest";

import { InMemoryOrganiserEventRepository } from "@/adapters/outbound/in-memory/in-memory-organiser-event-repository";
import { eventId } from "@/core/domain/event";
import { memberId } from "@/core/domain/member";
import { clientOrganisationId } from "@/core/domain/organisation";
import { raiseOrganiserEvent, type OrganiserEvent } from "@/core/domain/organiser-event";

import { ViewOrganisationEventsUseCase } from "./view-organisation-events";

const RAISED_AT = new Date("2026-09-08T02:00:00.000Z");

function organiserEvent(
  id: string,
  overrides: Partial<Parameters<typeof raiseOrganiserEvent>[0]> = {},
): OrganiserEvent {
  return raiseOrganiserEvent({
    id: eventId(id),
    clientOrganisationId: clientOrganisationId("org-acme"),
    responsibleOrganiserId: memberId("member-ada"),
    title: `Event ${id}`,
    raisedAt: RAISED_AT,
    ...overrides,
  });
}

function buildUseCase(seed: readonly OrganiserEvent[]) {
  return new ViewOrganisationEventsUseCase({
    organiserEvents: new InMemoryOrganiserEventRepository(seed),
  });
}

describe("ViewOrganisationEventsUseCase", () => {
  it("returns an event raised by a colleague in the caller's client organisation", async () => {
    const event = organiserEvent("event-1", {
      responsibleOrganiserId: memberId("member-grace"),
    });

    const { events } = await buildUseCase([event]).execute({
      clientOrganisationId: "org-acme",
    });

    expect(events).toEqual([
      {
        id: "event-1",
        title: "Event event-1",
        responsibleOrganiserId: "member-grace",
        raisedAt: RAISED_AT.toISOString(),
      },
    ]);
  });

  it("omits an event belonging to a different client organisation", async () => {
    const own = organiserEvent("event-mine");
    const other = organiserEvent("event-theirs", {
      clientOrganisationId: clientOrganisationId("org-globex"),
    });

    const { events } = await buildUseCase([own, other]).execute({
      clientOrganisationId: "org-acme",
    });

    expect(events.map((e) => e.id)).toEqual(["event-mine"]);
  });

  it("returns every event in the organisation regardless of which Organiser raised it", async () => {
    const first = organiserEvent("event-1", {
      responsibleOrganiserId: memberId("member-ada"),
    });
    const second = organiserEvent("event-2", {
      responsibleOrganiserId: memberId("member-grace"),
    });

    const { events } = await buildUseCase([first, second]).execute({
      clientOrganisationId: "org-acme",
    });

    expect(events.map((e) => e.id)).toEqual(["event-1", "event-2"]);
  });

  it("returns an empty list when the organisation has no events", async () => {
    await expect(
      buildUseCase([]).execute({ clientOrganisationId: "org-acme" }),
    ).resolves.toEqual({ events: [] });
  });
});
