import { describe, expect, it } from "vitest";

import { toEventCoordinatorDetails } from "./user-account-mapper";

describe("toEventCoordinatorDetails", () => {
  it("maps every non-credential user account column", () => {
    const coordinator = toEventCoordinatorDetails({
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

    expect(coordinator).toEqual({
      userAccountId: "4",
      name: "Amara Sithole",
      contactDetails: "amara@example.com",
      communicationPreferences: "Email",
      department: "Event Coordination",
      availability: "Available",
      clientOrganisationId: "7",
      createdAt: "2026-09-01T08:00:00.000Z",
      updatedAt: "2026-09-02T09:30:00.000Z",
    });
    expect(coordinator).not.toHaveProperty("credentialsHash");
  });
});
