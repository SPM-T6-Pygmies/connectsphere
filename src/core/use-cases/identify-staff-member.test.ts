import { describe, expect, it } from "vitest";

import { InMemoryAuth } from "@/adapters/outbound/in-memory/in-memory-auth";
import { InMemoryUserRepository } from "@/adapters/outbound/in-memory/in-memory-user-repository";
import type { UserWithRoles } from "@/core/ports/outbound/user-repository";

import { IdentifyStaffMemberUseCase } from "./identify-staff-member";

const AUTH_USER = "auth-user-1";
const SESSION = { userId: AUTH_USER, expiresAt: new Date("2026-12-31T23:59:59.000Z") };

function identify(user: UserWithRoles | null, session: typeof SESSION | null = SESSION) {
  const useCase = new IdentifyStaffMemberUseCase({
    auth: new InMemoryAuth({ session }),
    users: new InMemoryUserRepository(new Map(user === null ? [] : [[AUTH_USER, user]])),
  });
  return useCase.execute();
}

function user(roles: string[], clientOrganisationId: string | null = null): UserWithRoles {
  return { userId: "user-1", name: "Sam", roles, clientOrganisationId };
}

describe("IdentifyStaffMemberUseCase (SPM-122)", () => {
  it("identifies nobody when no one is signed in", async () => {
    await expect(identify(user(["Event Organiser"], "org-a"), null)).resolves.toBeNull();
  });

  it("identifies nobody when the signed-in auth user has no user account", async () => {
    await expect(identify(null)).resolves.toBeNull();
  });

  it("acts as an Event Organiser for their client organisation", async () => {
    await expect(identify(user(["Event Organiser"], "org-a"))).resolves.toEqual({
      name: "Sam",
      userAccountId: "user-1",
      organiser: { userAccountId: "user-1", clientOrganisationId: "org-a", name: "Sam" },
      coordinator: null,
      technicalSupport: null,
      workspaces: ["requester"],
      homeWorkspace: "requester",
    });
  });

  it("does not act as an Organiser who has no client organisation", async () => {
    const result = await identify(user(["Event Organiser"]));

    expect(result?.organiser).toBeNull();
  });

  it("acts as an Event Coordinator", async () => {
    await expect(identify(user(["Event Coordinator"]))).resolves.toEqual({
      name: "Sam",
      userAccountId: "user-1",
      organiser: null,
      coordinator: { userAccountId: "user-1", name: "Sam" },
      technicalSupport: null,
      workspaces: ["coordinator"],
      homeWorkspace: "coordinator",
    });
  });

  it("acts as neither for a role with no Organiser or Coordinator screens", async () => {
    await expect(identify(user(["Event Operations Manager"]))).resolves.toEqual({
      name: "Sam",
      userAccountId: "user-1",
      organiser: null,
      coordinator: null,
      technicalSupport: null,
      workspaces: ["ops"],
      homeWorkspace: "ops",
    });
  });

  it("opens the workspace of each staff role the member holds", async () => {
    const result = await identify(user(["Event Coordinator", "Venue Staff"]));

    expect(result?.workspaces).toEqual(["coordinator", "venue"]);
  });

  it("names the signed-in member of staff whatever their role", async () => {
    const result = await identify(user(["Venue Staff"]));

    expect(result?.name).toBe("Sam");
  });
});

describe("IdentifyStaffMemberUseCase technical support (SPM-187)", () => {
  it("AC16: gives a Technical Support Staff member their Technical Support context", async () => {
    const result = await identify(user(["Technical Support Staff"]));

    expect(result?.technicalSupport).toEqual({ userAccountId: "user-1" });
  });

  it("AC16: gives an Event Coordinator no Technical Support context", async () => {
    const result = await identify(user(["Event Coordinator"]));

    expect(result?.technicalSupport).toBeNull();
  });
});

describe("IdentifyStaffMemberUseCase home workspace (SPM-16)", () => {
  it("sends a member of staff back to the workspace of their role", async () => {
    const result = await identify(user(["Venue Staff"]));

    expect(result?.homeWorkspace).toBe("venue");
  });

  it("has nowhere to send an Organiser who has no client organisation", async () => {
    const result = await identify(user(["Event Organiser"]));

    expect(result?.homeWorkspace).toBeNull();
  });
});

describe("IdentifyStaffMemberUseCase (SPM-174)", () => {
  it("gives the member's own user account whatever their role, as the inbox subscriber", async () => {
    const result = await identify(user(["Venue Staff"]));

    expect(result?.userAccountId).toBe("user-1");
  });
});
