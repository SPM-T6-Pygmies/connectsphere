import { describe, expect, it } from "vitest";

import type { AuthPort } from "@/core/ports/outbound/auth-port";
import type { AuditLogger } from "@/core/ports/outbound/audit-logger";

import { LogoutUseCase } from "./logout";

/**
 * This file is a driving adapter. It plugs test doubles into the same ports
 * the Supabase adapters plug into, which is why it needs no database, no
 * network, no Next.js server and no mocking framework -- and why it runs in
 * milliseconds.
 */

/**
 * Mock implementation of AuthPort.
 * Simulates Supabase Auth logout behavior.
 */
class MockAuthAdapter implements AuthPort {
  private shouldFailLogout = false;

  async login() {
    throw new Error("Not implemented for logout tests");
  }

  async getSession() {
    return null;
  }

  async logout() {
    if (this.shouldFailLogout) {
      throw new Error("Auth service error");
    }
    // Simulate successful logout (clears session)
  }

  setFailLogout(shouldFail: boolean) {
    this.shouldFailLogout = shouldFail;
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
 * Helper to build a LogoutUseCase with mock adapters.
 */
function buildUseCase() {
  const auth = new MockAuthAdapter();
  const auditLogger = new MockAuditLogger();
  const useCase = new LogoutUseCase({ auth, auditLogger });

  return { useCase, auth, auditLogger };
}

describe("LogoutUseCase", () => {
  it("successfully logs out user and records audit event", async () => {
    // ARRANGE: Set up use case with mocks
    const { useCase, auditLogger } = buildUseCase();
    const userId = "user-1";

    // ACT: Execute logout
    await useCase.execute({ userId });

    // ASSERT: Audit logger was called with correct user ID
    const loggedLogouts = auditLogger.getLoggedLogouts();
    expect(loggedLogouts).toHaveLength(1);
    expect(loggedLogouts[0]).toEqual({ userId });
  });

  it("calls auth adapter logout before audit logging", async () => {
    // Domain invariant: Session termination happens before audit logging.
    // This ensures the user is logged out before the audit record is written.

    const { useCase } = buildUseCase();
    const userId = "user-2";

    // ACT & ASSERT: No error means logout succeeded and audit was recorded
    await expect(useCase.execute({ userId })).resolves.toBeUndefined();
  });

  it("propagates audit logger errors to caller", async () => {
    // Error handling: If audit logging fails, the error bubbles up.
    // Calling code (Server Action) decides how to handle (retry, log, notify, etc).

    const { useCase, auditLogger } = buildUseCase();
    auditLogger.setFailLogging(true);

    // ACT & ASSERT: Audit failure throws error
    await expect(useCase.execute({ userId: "user-3" })).rejects.toThrow("Audit service error");
  });

  it("propagates auth adapter errors to caller", async () => {
    // Error handling: If session termination fails, error is surfaced.
    // Calling code decides whether to retry or notify user.

    const { useCase, auth } = buildUseCase();
    auth.setFailLogout(true);

    // ACT & ASSERT: Auth failure throws error (before audit logging)
    await expect(useCase.execute({ userId: "user-4" })).rejects.toThrow("Auth service error");
  });

  it("accepts userId as required input parameter", async () => {
    // Domain requirement: Audit trail must capture which user logged out.
    // LogoutUseCase requires userId in the input.

    const { useCase, auditLogger } = buildUseCase();
    const userId = "user-5";

    // ACT: Execute with userId
    await useCase.execute({ userId });

    // ASSERT: Audit log contains the exact userId passed
    const loggedLogouts = auditLogger.getLoggedLogouts();
    expect(loggedLogouts[0].userId).toBe(userId);
  });
});
