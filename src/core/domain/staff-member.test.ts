import { describe, expect, it } from "vitest";

import { clientOrganisationId } from "./client-organisation";
import {
  coordinatorContextFor,
  hasNoStaffWorkspace,
  homeWorkspaceFor,
  isStaffWithNoHome,
  landingWorkspaceFor,
  organiserContextFor,
  safetyOfficerContextFor,
  technicalSupportContextFor,
  pageAreaOwner,
  workspacesFor,
  type StaffMember,
} from "./staff-member";
import { userAccountId } from "./user-account";

const ORG = clientOrganisationId("org-a");

function member(roles: string[], clientOrganisation: typeof ORG | null = null): StaffMember {
  return { userAccountId: userAccountId("user-1"), roles, clientOrganisationId: clientOrganisation };
}

describe("landingWorkspaceFor (SPM-122)", () => {
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

describe("workspacesFor (SPM-122)", () => {
  it("opens the workspace of every staff role a member of staff holds", () => {
    expect(workspacesFor(["Event Coordinator", "Event Operations Manager"])).toEqual([
      "coordinator",
      "ops",
    ]);
  });

  it("opens no workspace for a role that is not a staff role", () => {
    expect(workspacesFor(["Attendee"])).toEqual([]);
  });
});

describe("organiserContextFor (SPM-122)", () => {
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

describe("coordinatorContextFor (SPM-122)", () => {
  it("acts as an Event Coordinator", () => {
    expect(coordinatorContextFor(member(["Event Coordinator"]))).toEqual({
      userAccountId: userAccountId("user-1"),
    });
  });

  it("does not act as a Coordinator for any other role", () => {
    expect(coordinatorContextFor(member(["Event Organiser"], ORG))).toBeNull();
  });
});

describe("technicalSupportContextFor (SPM-187)", () => {
  it("AC16: acts as Technical Support Staff for a member holding that role", () => {
    expect(technicalSupportContextFor(member(["Technical Support Staff"]))).toEqual({
      userAccountId: userAccountId("user-1"),
    });
  });

  it("AC16: acts as Technical Support Staff for one who also holds another role", () => {
    expect(technicalSupportContextFor(member(["Event Coordinator", "Technical Support Staff"]))).toEqual({
      userAccountId: userAccountId("user-1"),
    });
  });

  it.each(["Event Coordinator", "Event Operations Manager", "Venue Staff", "Attendee"])(
    "AC16: does not act as Technical Support Staff for %s",
    (role) => {
      expect(technicalSupportContextFor(member([role]))).toBeNull();
    },
  );

  it("AC16: does not act as Technical Support Staff for an Event Organiser", () => {
    expect(technicalSupportContextFor(member(["Event Organiser"], ORG))).toBeNull();
  });

  it("AC16: does not act as Technical Support Staff for someone with no role", () => {
    expect(technicalSupportContextFor(member([]))).toBeNull();
  });
});

describe("pageAreaOwner (SPM-16)", () => {
  it.each([
    ["requester", "Event Organiser"],
    ["coordinator", "Event Coordinator"],
    ["ops", "Event Operations Manager"],
    ["venue", "Venue Staff"],
    ["technical", "Technical Support Staff"],
  ] as const)("names %s's owner as %s", (area, role) => {
    expect(pageAreaOwner(area)).toBe(role);
  });
});

describe("homeWorkspaceFor (SPM-16)", () => {
  it.each([
    ["Event Coordinator", "coordinator"],
    ["Event Operations Manager", "ops"],
    ["Venue Staff", "venue"],
    ["Technical Support Staff", "technical"],
  ])("sends %s back to %s", (role, workspace) => {
    expect(homeWorkspaceFor(member([role]))).toBe(workspace);
  });

  it("sends an Event Organiser with a client organisation back to requester", () => {
    expect(homeWorkspaceFor(member(["Event Organiser"], ORG))).toBe("requester");
  });

  it("has nowhere to send an Event Organiser with no client organisation", () => {
    expect(homeWorkspaceFor(member(["Event Organiser"]))).toBeNull();
  });

  it("has nowhere to send someone with no staff role", () => {
    expect(homeWorkspaceFor(member(["Attendee"]))).toBeNull();
  });
});

describe("hasNoStaffWorkspace (SPM-192)", () => {
  it("is true for someone with no staff workspace, such as an Attendee", () => {
    expect(hasNoStaffWorkspace(workspacesFor(["Attendee"]))).toBe(true);
  });

  it("is false for a staff member who has at least one workspace", () => {
    expect(hasNoStaffWorkspace(workspacesFor(["Event Coordinator"]))).toBe(false);
  });

  it("is false for an Event Organiser with no client organisation, who still has a workspace", () => {
    // homeWorkspaceFor is null for these same roles -- this pins down that
    // hasNoStaffWorkspace answers a different question and must stay false.
    expect(hasNoStaffWorkspace(workspacesFor(["Event Organiser"]))).toBe(false);
  });
});

describe("isStaffWithNoHome (SPM-188)", () => {
  it("is true for an Event Organiser with no client organisation", () => {
    const roles = ["Event Organiser"];
    expect(isStaffWithNoHome(workspacesFor(roles), homeWorkspaceFor(member(roles)))).toBe(true);
  });

  it("is false for someone with no staff role at all -- that's hasNoStaffWorkspace's case", () => {
    const roles = ["Attendee"];
    expect(isStaffWithNoHome(workspacesFor(roles), homeWorkspaceFor(member(roles)))).toBe(false);
  });

  it("is false for a staff member who has a home to go to", () => {
    const roles = ["Event Coordinator"];
    expect(isStaffWithNoHome(workspacesFor(roles), homeWorkspaceFor(member(roles)))).toBe(false);
  });

  it("is false for an Event Organiser who does have a client organisation", () => {
    expect(
      isStaffWithNoHome(workspacesFor(["Event Organiser"]), homeWorkspaceFor(member(["Event Organiser"], ORG))),
    ).toBe(false);
  });
});

describe("Safety Officer role (SPM-258)", () => {
  it("lands a Safety Officer on the safety workspace", () => {
    expect(landingWorkspaceFor(["Safety Officer"])).toBe("safety");
  });

  it("opens the safety workspace alongside another role's", () => {
    expect(workspacesFor(["Venue Staff", "Safety Officer"])).toEqual(["venue", "safety"]);
  });

  it.each(["Event Coordinator", "Event Operations Manager", "Venue Staff", "Technical Support Staff", "Attendee"])(
    "does not open the safety workspace for %s",
    (role) => {
      expect(workspacesFor([role])).not.toContain("safety");
    },
  );

  it("names the Safety Officer as who to contact about the safety area", () => {
    expect(pageAreaOwner("safety")).toBe("Safety Officer");
  });

  it("sends a Safety Officer denied a page back to the safety workspace", () => {
    expect(homeWorkspaceFor(member(["Safety Officer"]))).toBe("safety");
  });
});

describe("safetyOfficerContextFor (SPM-259)", () => {
  it("AC7: acts as a Safety Officer for a member holding that role, alongside another", () => {
    expect(safetyOfficerContextFor(member(["Event Coordinator", "Safety Officer"]))).toEqual({
      userAccountId: userAccountId("user-1"),
    });
  });

  it.each(["Event Coordinator", "Event Operations Manager", "Venue Staff", "Technical Support Staff"])(
    "AC7: does not act as a Safety Officer for %s",
    (role) => {
      expect(safetyOfficerContextFor(member([role]))).toBeNull();
    },
  );
});
