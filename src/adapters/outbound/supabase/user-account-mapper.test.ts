import { describe, expect, it } from "vitest";

import { eventCoordinatorToDomain } from "./user-account-mapper";

describe("eventCoordinatorToDomain", () => {
  it("maps every non-credential user account column", () => {
    const account = eventCoordinatorToDomain({
      user_account_id: 4,
      name: "Amara Sithole",
      contact_details: "amara@example.com",
      communication_preferences: "Email",
      department: "Event Coordination",
      availability: "Available",
      client_organisation_id: 7,
      created_at: "2026-09-01T08:00:00.000Z",
      updated_at: "2026-09-02T09:30:00.000Z",
    });

    expect(account).toEqual({
      id: "4",
      name: "Amara Sithole",
      contactDetails: "amara@example.com",
      communicationPreferences: "Email",
      department: "Event Coordination",
      availability: "Available",
      clientOrganisationId: "7",
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
      updatedAt: new Date("2026-09-02T09:30:00.000Z"),
    });
    expect(account).not.toHaveProperty("credentialsHash");
  });
});
