import { describe, expect, it } from "vitest";

import { InMemoryAuth } from "@/adapters/outbound/in-memory/in-memory-auth";
import { InMemoryUserRepository } from "@/adapters/outbound/in-memory/in-memory-user-repository";
import { InvalidCredentialsError, NoStaffRoleError } from "@/core/domain/errors";
import type { LoginCommand } from "@/core/use-cases/login";
import type { UserWithRoles } from "@/core/ports/outbound/user-repository";

import { LoginUseCase } from "./login";

/**
 * This file is a driving adapter. It plugs test doubles into the same ports
 * the Supabase adapters plug into, which is why it needs no database, no
 * network, no Next.js server and no mocking framework -- and why it runs in
 * milliseconds.
 */

// Test data: staff members with roles for login scenarios
const COORDINATOR_ID = "auth-user-coordinator";
const LEAD_ID = "auth-user-lead";

const COORDINATOR_EMAIL = "coordinator@test.com";
const COORDINATOR_PASSWORD = "TestPass123!";
const COORDINATOR_USER: UserWithRoles = {
  userId: "user-1",
  name: "Test Coordinator",
  roles: ["Event Coordinator"],
  clientOrganisationId: null,
};

const LEAD_EMAIL = "lead@test.com";
const LEAD_PASSWORD = "TestPass123!";
const LEAD_USER: UserWithRoles = {
  userId: "user-2",
  name: "Test Coordinator Lead",
  roles: ["Event Coordinator Lead"],
  clientOrganisationId: null,
};

// An account with no staff role -- an Attendee is the real-world example,
// since the customer confirmed Attendees never get an account, but the rule
// covers any role absent from the staff workspace table (SPM-192).
const NO_STAFF_ROLE_ID = "auth-user-attendee";
const NO_STAFF_ROLE_EMAIL = "attendee@test.com";
const NO_STAFF_ROLE_PASSWORD = "TestPass123!";
const NO_STAFF_ROLE_USER: UserWithRoles = {
  userId: "user-3",
  name: "Test Attendee",
  roles: ["Attendee"],
  clientOrganisationId: null,
};

const EXPIRES_AT = new Date("2026-12-31T23:59:59.000Z");

/**
 * Helper to build a LoginUseCase with in-memory adapters.
 * Returns the use case and adapters for assertions in tests.
 */
function buildUseCase() {
  const auth = new InMemoryAuth({
    credentials: [
      { email: COORDINATOR_EMAIL, password: COORDINATOR_PASSWORD, authUserId: COORDINATOR_ID, expiresAt: EXPIRES_AT },
      { email: LEAD_EMAIL, password: LEAD_PASSWORD, authUserId: LEAD_ID, expiresAt: EXPIRES_AT },
      { email: NO_STAFF_ROLE_EMAIL, password: NO_STAFF_ROLE_PASSWORD, authUserId: NO_STAFF_ROLE_ID, expiresAt: EXPIRES_AT },
    ],
  });
  const users = new InMemoryUserRepository(
    new Map([
      [COORDINATOR_ID, COORDINATOR_USER],
      [LEAD_ID, LEAD_USER],
      [NO_STAFF_ROLE_ID, NO_STAFF_ROLE_USER],
    ]),
  );
  const useCase = new LoginUseCase({ auth, users });

  return { useCase, auth, users };
}

describe("LoginUseCase (SPM-117)", () => {
  it("authenticates valid staff member and returns user ID with roles", async () => {
    // ARRANGE: Set up use case with in-memory adapters
    const { useCase } = buildUseCase();

    // ACT: Execute login with valid credentials
    const result = await useCase.execute({
      email: COORDINATOR_EMAIL,
      password: COORDINATOR_PASSWORD,
    } as LoginCommand);

    // ASSERT: Result contains user ID and staff roles
    // (expiresAt is ISO string from LoginUseCase.execute)
    expect(result).toEqual({
      userId: COORDINATOR_USER.userId,
      roles: COORDINATOR_USER.roles,
      expiresAt: EXPIRES_AT.toISOString(),
      landingWorkspace: "coordinator",
    });
  });

  it("rejects login with invalid password", async () => {
    // Test security: Wrong password should not authenticate,
    // even if email exists in auth.users.
    const { useCase } = buildUseCase();

    // ACT & ASSERT: Expect generic error (security: no user enumeration)
    await expect(
      useCase.execute({
        email: COORDINATOR_EMAIL,
        password: "WrongPassword123!",
      } as LoginCommand)
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects login with non-existent email", async () => {
    // Test security: Attacker should not be able to discover which emails exist.
    // Both "email not found" and "wrong password" return the same generic error.
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        email: "nonexistent@test.com",
        password: "TestPass123!",
      } as LoginCommand)
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });


  it("maps auth errors to generic InvalidCredentialsError for security", async () => {
    // Test security requirement: All auth failures (wrong password, user not found,
    // timeout, DB error) return the same generic error.
    // This prevents user enumeration attacks.

    const { useCase } = buildUseCase();

    // Both these should throw InvalidCredentialsError (not different errors)
    const wrongPassword = useCase.execute({
      email: COORDINATOR_EMAIL,
      password: "WRONG",
    } as LoginCommand);

    const noAccount = useCase.execute({
      email: "nobody@test.com",
      password: "TestPass123!",
    } as LoginCommand);

    await expect(wrongPassword).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(noAccount).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects login for an account with no staff role, and signs it back out (SPM-192)", async () => {
    // An Attendee is never issued an account in the real product, but any
    // account with no staff role must be refused the same way -- not sent
    // into /staff with nowhere to land.
    const { useCase, auth } = buildUseCase();

    await expect(
      useCase.execute({
        email: NO_STAFF_ROLE_EMAIL,
        password: NO_STAFF_ROLE_PASSWORD,
      } as LoginCommand)
    ).rejects.toBeInstanceOf(NoStaffRoleError);

    // The session `auth.login()` started must not survive the rejection.
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it("returns session expiration timestamp for cookie management", async () => {
    // Supabase Auth returns session.expiresAt (Date).
    // LoginUseCase converts to ISO string for JSON serialization.
    // Calling code (middleware, Task 6) uses this to refresh sessions.

    const { useCase } = buildUseCase();

    const result = await useCase.execute({
      email: COORDINATOR_EMAIL,
      password: COORDINATOR_PASSWORD,
    } as LoginCommand);

    // Verify expiresAt is ISO string (can be parsed back to Date)
    expect(typeof result.expiresAt).toBe("string");
    expect(new Date(result.expiresAt)).toEqual(EXPIRES_AT);
  });
});

describe("LoginUseCase for a Safety Officer (SPM-258)", () => {
  it("signs a Safety Officer in and sends them to the safety workspace", async () => {
    const authUserId = "auth-user-safety";
    const useCase = new LoginUseCase({
      auth: new InMemoryAuth({
        credentials: [{ email: "safety@test.com", password: "TestPass123!", authUserId, expiresAt: EXPIRES_AT }],
      }),
      users: new InMemoryUserRepository(
        new Map([
          [authUserId, { userId: "user-4", name: "Test Safety Officer", roles: ["Safety Officer"], clientOrganisationId: null }],
        ]),
      ),
    });

    const result = await useCase.execute({ email: "safety@test.com", password: "TestPass123!" });

    expect(result.landingWorkspace).toBe("safety");
  });
});
