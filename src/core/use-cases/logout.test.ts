import { describe, expect, it } from "vitest";

import { InMemoryAuth } from "@/adapters/outbound/in-memory/in-memory-auth";
import { InMemoryUserRepository } from "@/adapters/outbound/in-memory/in-memory-user-repository";
import type { AuthPort, SessionData } from "@/core/ports/outbound/auth-port";
import type { AuditLogger } from "@/core/ports/outbound/audit-logger";
import type { UserWithRoles } from "@/core/ports/outbound/user-repository";

import { LogoutUseCase } from "./logout";

/**
 * This file is a driving adapter. It plugs test doubles into the same ports
 * the Supabase adapters plug into, which is why it needs no database, no
 * network, no Next.js server and no mocking framework -- and why it runs in
 * milliseconds.
 */

const AUTH_USER = "auth-user-1";
const SESSION: SessionData = { userId: AUTH_USER, expiresAt: new Date("2026-12-31T23:59:59.000Z") };
const USER: UserWithRoles = {
  userId: "user-1",
  name: "Test Coordinator",
  roles: ["Event Coordinator"],
  clientOrganisationId: null,
};

/** An auth service whose sign-out fails. */
class FailingSignOutAuth extends InMemoryAuth {
  override async logout(): Promise<void> {
    throw new Error("Auth service error");
  }
}

/**
 * Mock implementation of AuditLogger.
 * Tracks audit logging calls.
 */
class MockAuditLogger implements AuditLogger {
  private loggedLogouts: Array<{ userId: string }> = [];
  private shouldFailLogging = false;

  async logLogout(userId: string) {
    if (this.shouldFailLogging) {
      throw new Error("Audit service error");
    }
    this.loggedLogouts.push({ userId });
  }

  getLoggedLogouts() {
    return this.loggedLogouts;
  }

  setFailLogging(shouldFail: boolean) {
    this.shouldFailLogging = shouldFail;
  }
}

/**
 * Helper to build a LogoutUseCase with test doubles: by default a signed-in
 * auth user who has a user account.
 */
function buildUseCase({
  auth = new InMemoryAuth({ session: SESSION }),
  user = USER,
}: { auth?: AuthPort; user?: UserWithRoles | null } = {}) {
  const users = new InMemoryUserRepository(new Map(user === null ? [] : [[AUTH_USER, user]]));
  const auditLogger = new MockAuditLogger();
  const useCase = new LogoutUseCase({ auth, users, auditLogger });

  return { useCase, auth, auditLogger };
}

describe("LogoutUseCase (SPM-14)", () => {
  it("successfully logs out user and records audit event", async () => {
    const { useCase, auth, auditLogger } = buildUseCase();

    await useCase.execute();

    await expect(auth.getSession()).resolves.toBeNull();
    expect(auditLogger.getLoggedLogouts()).toEqual([{ userId: USER.userId }]);
  });

  it("calls auth adapter logout before audit logging", async () => {
    // Domain invariant: Session termination happens before audit logging.
    // This ensures the user is logged out before the audit record is written.
    const auth = new InMemoryAuth({ session: SESSION });
    const sessionsWhenAudited: Array<SessionData | null> = [];
    const auditLogger: AuditLogger = {
      logLogout: async () => {
        sessionsWhenAudited.push(await auth.getSession());
      },
    };
    const useCase = new LogoutUseCase({
      auth,
      users: new InMemoryUserRepository(new Map([[AUTH_USER, USER]])),
      auditLogger,
    });

    await useCase.execute();

    expect(sessionsWhenAudited).toEqual([null]);
  });

  it("propagates audit logger errors to caller", async () => {
    // Error handling: If audit logging fails, the error bubbles up.
    // Calling code (Server Action) decides how to handle (retry, log, notify, etc).

    const { useCase, auditLogger } = buildUseCase();
    auditLogger.setFailLogging(true);

    await expect(useCase.execute()).rejects.toThrow("Audit service error");
  });

  it("propagates auth adapter errors to caller", async () => {
    // Error handling: If session termination fails, error is surfaced.
    // Calling code decides whether to retry or notify user.

    const { useCase, auditLogger } = buildUseCase({ auth: new FailingSignOutAuth({ session: SESSION }) });

    await expect(useCase.execute()).rejects.toThrow("Auth service error");
    expect(auditLogger.getLoggedLogouts()).toHaveLength(0);
  });

  it("signs out without an audit record when the caller has no user account", async () => {
    // An audit record needs a user account to point at, so none is written --
    // but the session still ends rather than leaving the caller signed in.

    const { useCase, auth, auditLogger } = buildUseCase({ user: null });

    await expect(useCase.execute()).resolves.toBeUndefined();
    await expect(auth.getSession()).resolves.toBeNull();
    expect(auditLogger.getLoggedLogouts()).toHaveLength(0);
  });

  it("does nothing when nobody is signed in", async () => {
    const { useCase, auditLogger } = buildUseCase({ auth: new InMemoryAuth() });

    await expect(useCase.execute()).resolves.toBeUndefined();
    expect(auditLogger.getLoggedLogouts()).toHaveLength(0);
  });
});
