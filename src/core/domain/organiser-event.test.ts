import { describe, expect, it } from "vitest";

import { eventId } from "./event";
import { memberId } from "./member";
import { clientOrganisationId } from "./organisation";
import { raiseOrganiserEvent } from "./organiser-event";

const NOW = new Date("2026-09-07T09:00:00.000Z");

function validParams() {
  return {
    id: eventId("event-1"),
    clientOrganisationId: clientOrganisationId("org-acme"),
    responsibleOrganiserId: memberId("member-ada"),
    title: "Vendor onboarding kickoff",
    raisedAt: NOW,
  };
}

describe("raiseOrganiserEvent", () => {
  it("constructs an event scoped to one client organisation and one responsible Organiser", () => {
    const event = raiseOrganiserEvent(validParams());

    expect(event.clientOrganisationId).toBe("org-acme");
    expect(event.responsibleOrganiserId).toBe("member-ada");
  });

  it("rejects a blank client organisation id", () => {
    expect(() => clientOrganisationId("   ")).toThrow(/not a usable client organisation id/);
  });

  it("rejects a blank event id", () => {
    expect(() => eventId("")).toThrow(/not a usable event id/);
  });
});
