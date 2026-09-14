import { describe, expect, it } from "vitest";

import { toDomain, type CoordinatorEventRow } from "./coordinator-event-mapper";

describe("coordinator event mapper", () => {
  it("carries the request the event was opened from", () => {
    const row: CoordinatorEventRow = {
      event_id: 5,
      event_request_id: 24,
      name: "Operations Roadmap Conference",
      status: "Planning",
      preferred_date: "2026-11-20",
      assigned_coordinator_user_account_id: 2,
      client_organisation_id: 1,
    };

    expect(toDomain(row)).toEqual({
      id: "5",
      eventRequestId: "24",
      name: "Operations Roadmap Conference",
      status: "Planning",
      preferredDate: "2026-11-20",
      clientOrganisationId: "1",
      assignedCoordinatorUserAccountId: "2",
    });
  });

  it("maps a deleted request to no request, not to an id", () => {
    const row: CoordinatorEventRow = {
      event_id: 5,
      event_request_id: null,
      name: "Operations Roadmap Conference",
      status: "Planning",
      preferred_date: null,
      assigned_coordinator_user_account_id: 2,
      client_organisation_id: 1,
    };

    expect(toDomain(row).eventRequestId).toBeNull();
  });
});
