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

describe("IdentifyStaffMemberUseCase", () => {
  it("identifies nobody when no one is signed in", async () => {
    await expect(identify(user(["Event Organiser"], "org-a"), null)).resolves.toBeNull();
  });

  it("identifies nobody when the signed-in auth user has no user account", async () => {
    await expect(identify(null)).resolves.toBeNull();
  });

  it("acts as an Event Organiser for their client organisation", async () => {
    await expect(identify(user(["Event Organiser"], "org-a"))).resolves.toEqual({
      organiser: { userAccountId: "user-1", clientOrganisationId: "org-a", name: "Sam" },
      coordinator: null,
    });
  });

  it("does not act as an Organiser who has no client organisation", async () => {
    const result = await identify(user(["Event Organiser"]));

    expect(result?.organiser).toBeNull();
  });

  it("acts as an Event Coordinator", async () => {
    await expect(identify(user(["Event Coordinator"]))).resolves.toEqual({
      organiser: null,
      coordinator: { userAccountId: "user-1" },
    });
  });

  it("acts as neither for a role with no Organiser or Coordinator screens", async () => {
    await expect(identify(user(["Event Operations Manager"]))).resolves.toEqual({
      organiser: null,
      coordinator: null,
    });
  });
});
