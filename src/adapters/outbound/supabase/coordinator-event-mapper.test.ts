import { describe, expect, it } from "vitest";

import { toAssignedEventSummary, type CoordinatorEventRow } from "./coordinator-event-mapper";

describe("coordinator event mapper (SPM-137)", () => {
  const row: CoordinatorEventRow = {
    event_id: 5,
    event_request_id: 24,
    name: "Operations Roadmap Conference",
    status: "Planning",
    preferred_date: "2026-11-20",
    assigned_coordinator_user_account_id: 2,
    client_organisation_id: 1,
  };
  const organisationNames = new Map([[1, "Test Organisation"]]);

  it("carries the request the event was opened from, and names its client organisation", () => {
    expect(toAssignedEventSummary(row, organisationNames)).toEqual({
      id: "5",
      eventRequestId: "24",
      name: "Operations Roadmap Conference",
      clientOrganisationName: "Test Organisation",
      preferredDate: "2026-11-20",
      status: "Planning",
    });
  });

  it("maps a deleted request to no request, not to an id", () => {
    expect(
      toAssignedEventSummary({ ...row, event_request_id: null, preferred_date: null }, organisationNames)
        .eventRequestId,
    ).toBeNull();
  });

  it("leaves an organisation the name lookup did not return unnamed, rather than failing", () => {
    expect(toAssignedEventSummary(row, new Map()).clientOrganisationName).toBe("");
  });
});
