import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryConnectionRepository } from "@/adapters/outbound/in-memory/in-memory-connection-repository";
import { InMemoryMemberDirectory } from "@/adapters/outbound/in-memory/in-memory-member-directory";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { connectionId, type Connection, type ConnectionStatus } from "@/core/domain/connection";
import {
  DuplicateConnectionError,
  MemberNotFoundError,
  SelfConnectionError,
} from "@/core/domain/errors";
import { memberId } from "@/core/domain/member";

import { SendConnectionRequestUseCase } from "./send-connection-request";

/**
 * This file is a driving adapter. It plugs test doubles into the same ports
 * the Supabase adapters plug into, which is why it needs no database, no
 * network, no Next.js server and no mocking framework -- and why it runs in
 * milliseconds.
 */

const ADA = "member-ada";
const GRACE = "member-grace";
const NOW = new Date("2026-09-02T10:00:00.000Z");

function existingConnection(status: ConnectionStatus): Connection {
  return {
    id: connectionId("connection-existing"),
    requesterId: memberId(ADA),
    addresseeId: memberId(GRACE),
    status,
    requestedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function buildUseCase(options: { members?: string[]; seed?: Connection[] } = {}) {
  const connections = new InMemoryConnectionRepository(options.seed ?? []);
  const notifier = new RecordingNotifier();
  const useCase = new SendConnectionRequestUseCase({
    connections,
    members: new InMemoryMemberDirectory(options.members ?? [ADA, GRACE]),
    notifier,
    clock: new FixedClock(NOW),
  });
  return { useCase, connections, notifier };
}

describe("SendConnectionRequestUseCase", () => {
  it("records a pending connection and notifies the addressee", async () => {
    const { useCase, connections, notifier } = buildUseCase();

    const result = await useCase.execute({ requesterId: ADA, addresseeId: GRACE });

    expect(result).toEqual({ connectionId: "connection-1", status: "pending" });
    expect(connections.all()).toEqual([
      {
        id: "connection-1",
        requesterId: ADA,
        addresseeId: GRACE,
        status: "pending",
        requestedAt: NOW,
      },
    ]);
    expect(notifier.sent).toHaveLength(1);
  });

  it("rejects a member connecting with themselves", async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute({ requesterId: ADA, addresseeId: ADA })).rejects.toBeInstanceOf(
      SelfConnectionError,
    );
  });

  it("rejects a self-connection before touching any infrastructure", async () => {
    // The domain invariant runs first, so an invalid command costs zero I/O.
    const { useCase, connections, notifier } = buildUseCase({ members: [] });

    await expect(useCase.execute({ requesterId: ADA, addresseeId: ADA })).rejects.toBeInstanceOf(
      SelfConnectionError,
    );
    expect(connections.all()).toEqual([]);
    expect(notifier.sent).toEqual([]);
  });

  it("rejects an addressee who does not exist", async () => {
    const { useCase } = buildUseCase({ members: [ADA] });

    await expect(useCase.execute({ requesterId: ADA, addresseeId: GRACE })).rejects.toBeInstanceOf(
      MemberNotFoundError,
    );
  });

  it.each(["pending", "accepted"] as const)(
    "rejects a duplicate when a %s connection already exists",
    async (status) => {
      const { useCase, notifier } = buildUseCase({ seed: [existingConnection(status)] });

      await expect(
        useCase.execute({ requesterId: ADA, addresseeId: GRACE }),
      ).rejects.toBeInstanceOf(DuplicateConnectionError);
      expect(notifier.sent).toEqual([]);
    },
  );

  it("matches an existing connection regardless of who requested it", async () => {
    const { useCase } = buildUseCase({ seed: [existingConnection("pending")] });

    // Grace asking Ada is the same relationship as Ada asking Grace.
    await expect(
      useCase.execute({ requesterId: GRACE, addresseeId: ADA }),
    ).rejects.toBeInstanceOf(DuplicateConnectionError);
  });

  it("allows a fresh request after a previous one was declined", async () => {
    const { useCase, notifier } = buildUseCase({ seed: [existingConnection("declined")] });

    const result = await useCase.execute({ requesterId: ADA, addresseeId: GRACE });

    expect(result.status).toBe("pending");
    expect(notifier.sent).toHaveLength(1);
  });

  it("rejects a blank member id", async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute({ requesterId: "   ", addresseeId: GRACE })).rejects.toThrow(
      /not a usable member id/,
    );
  });
});
