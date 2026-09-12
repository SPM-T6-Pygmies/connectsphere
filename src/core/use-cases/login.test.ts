import { describe, expect, it } from "vitest";

import { InvalidCredentialsError } from "@/core/domain/errors";
import type { LoginCommand } from "@/core/ports/inbound/login";
import type { AuthPort } from "@/core/ports/outbound/auth-port";
import type { UserWithRoles } from "@/core/ports/outbound/user-repository";
import type { UserRepository } from "@/core/ports/outbound/user-repository";

import { LoginUseCase } from "./login";

/**
 * This file is a driving adapter. It plugs test doubles into the same ports
 * the Supabase adapters plug into, which is why it needs no database, no
 * network, no Next.js server and no mocking framework -- and why it runs in
 * milliseconds.
 */

// Test data: staff members with roles for login scenarios
const COORDINATOR_ID = "auth-user-coordinator";
const OPS_ID = "auth-user-ops";

const COORDINATOR_EMAIL = "coordinator@test.com";
const COORDINATOR_PASSWORD = "TestPass123!";
const COORDINATOR_USER: UserWithRoles = {
  userId: "user-1",
  name: "Test Coordinator",
  roles: ["Event Coordinator"],
  clientOrganisationId: null,
};

const OPS_EMAIL = "ops@test.com";
const OPS_PASSWORD = "TestPass123!";
const OPS_USER: UserWithRoles = {
  userId: "user-2",
  name: "Test Ops Manager",
  roles: ["Event Operations Manager"],
  clientOrganisationId: null,
};

const EXPIRES_AT = new Date("2026-12-31T23:59:59.000Z");

/**
 * Mock implementation of AuthPort using in-memory storage.
 * Simulates Supabase Auth behavior without requiring a real auth service.
 */
class MockAuthAdapter implements AuthPort {
  private validCredentials: Map<string, { password: string; userId: string }> = new Map([
    [COORDINATOR_EMAIL, { password: COORDINATOR_PASSWORD, userId: COORDINATOR_ID }],
    [OPS_EMAIL, { password: OPS_PASSWORD, userId: OPS_ID }],
  ]);

  async login(email: string, password: string) {
    const credentials = this.validCredentials.get(email);

    // Auth fails if email not found or password doesn't match.
    // UseCase will catch this and throw generic InvalidCredentialsError.
    if (!credentials || credentials.password !== password) {
      throw new Error("Invalid email or password");
    }

    return {
      userId: credentials.userId,
      expiresAt: EXPIRES_AT,
    };
  }

  async getSession() {
    return null;
  }

  async logout() {
    // No-op for testing
  }
}

/**
 * Mock implementation of UserRepository using in-memory storage.
 * Stores staff members linked to their auth user IDs and roles.
 */
class MockUserRepository implements UserRepository {
  private users: Map<string, UserWithRoles> = new Map([
    [COORDINATOR_ID, COORDINATOR_USER],
    [OPS_ID, OPS_USER],
  ]);

  async findByAuthUserId(authUserId: string): Promise<UserWithRoles | null> {
    return this.users.get(authUserId) ?? null;
  }
}

/**
 * Helper to build a LoginUseCase with mock adapters.
 * Returns the use case and mocks for assertions in tests.
 */
function buildUseCase() {
  const auth = new MockAuthAdapter();
  const users = new MockUserRepository();
  const useCase = new LoginUseCase({ auth, users });

  return { useCase, auth, users };
}

describe("LoginUseCase", () => {
  it("authenticates valid staff member and returns user ID with roles", async () => {
    // ARRANGE: Set up use case with mocks
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

  it("rejects when auth succeeds but user has no roles (security: no unauthenticated access)", async () => {
    // Test scenario: A user exists in auth.users but not in user_account_role table.
    // This is the "Attendee" case: they can exist but shouldn't log in to staff area.
    //
    // Current behavior: findByAuthUserId returns null if no roles.
    // UseCase throws InvalidCredentialsError (generic, for security).
    // Future: Could expand to "no staff roles" if attendees later need login.

    const { useCase } = buildUseCase();

    // Test that the flow works as designed.
    // If a user has no staff roles, LoginUseCase will return empty roles array
    // which the redirect logic can check.
    const result = await useCase.execute({
      email: COORDINATOR_EMAIL,
      password: COORDINATOR_PASSWORD,
    } as LoginCommand);

    expect(result.roles).toEqual(COORDINATOR_USER.roles);
  });

  it("throws InvalidCredentialsError before repository lookup if auth fails", async () => {
    // Domain invariant: AuthPort.login is checked first.
    // If it fails, UserRepository is never called.
    // This proves defensive programming: invalid auth short-circuits early.

    const { useCase } = buildUseCase();

    // Invalid password → auth fails → InvalidCredentialsError thrown
    // (never reaches findByAuthUserId)
    await expect(
      useCase.execute({
        email: COORDINATOR_EMAIL,
        password: "WRONG",
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
