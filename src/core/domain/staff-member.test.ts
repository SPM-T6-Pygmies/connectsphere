import { describe, expect, it } from "vitest";

import { clientOrganisationId } from "./client-organisation";
import {
  coordinatorContextFor,
  landingWorkspaceFor,
  organiserContextFor,
  type StaffMember,
} from "./staff-member";
import { userAccountId } from "./user-account";

const ORG = clientOrganisationId("org-a");

function member(roles: string[], clientOrganisation: typeof ORG | null = null): StaffMember {
  return { userAccountId: userAccountId("user-1"), roles, clientOrganisationId: clientOrganisation };
}

describe("landingWorkspaceFor", () => {
  it.each([
    ["Event Organiser", "requester"],
    ["Event Coordinator", "coordinator"],
    ["Event Operations Manager", "ops"],
    ["Venue Staff", "venue"],
    ["Technical Support Staff", "technical"],
  ])("sends %s to %s", (role, workspace) => {
    expect(landingWorkspaceFor([role])).toBe(workspace);
  });

  it("uses the first role when a member of staff holds several", () => {
    expect(landingWorkspaceFor(["Event Coordinator", "Event Organiser"])).toBe("coordinator");
  });

  it("has nowhere to send someone with no role", () => {
    expect(landingWorkspaceFor([])).toBeNull();
  });

  it("has nowhere to send someone whose first role is not a staff role", () => {
    expect(landingWorkspaceFor(["Attendee", "Event Organiser"])).toBeNull();
  });
});

describe("organiserContextFor", () => {
  it("acts as an Event Organiser for their client organisation", () => {
    expect(organiserContextFor(member(["Event Organiser"], ORG))).toEqual({
      userAccountId: userAccountId("user-1"),
      clientOrganisationId: ORG,
    });
  });

  it("does not act as an Organiser who has no client organisation", () => {
    expect(organiserContextFor(member(["Event Organiser"]))).toBeNull();
  });

  it("does not act as an Organiser for any other role", () => {
    expect(organiserContextFor(member(["Event Coordinator"], ORG))).toBeNull();
  });
});

describe("coordinatorContextFor", () => {
  it("acts as an Event Coordinator", () => {
    expect(coordinatorContextFor(member(["Event Coordinator"]))).toEqual({
      userAccountId: userAccountId("user-1"),
    });
  });

  it("does not act as a Coordinator for any other role", () => {
    expect(coordinatorContextFor(member(["Event Organiser"], ORG))).toBeNull();
  });
});
