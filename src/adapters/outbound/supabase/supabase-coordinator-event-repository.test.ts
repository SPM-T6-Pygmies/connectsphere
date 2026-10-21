import { describe, expect, it } from "vitest";

import { CoordinatorEventNotFoundError, EventNotCancellableError } from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import { SupabaseCoordinatorEventRepository } from "./supabase-coordinator-event-repository";

type RpcResult = {
  data: unknown;
  error: { code?: string; message: string; details?: string } | null;
};

function fakeClient(answers: Record<string, RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return answers[name] ?? { data: null, error: null };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

describe("SupabaseCoordinatorEventRepository, cancelling an event (SPM-55)", () => {
  it("asks the database to cancel the event for this coordinator", async () => {
    const { client, calls } = fakeClient({});

    await new SupabaseCoordinatorEventRepository(client).cancelEvent(userAccountId("2"), "7");

    expect(calls).toEqual([
      {
        name: "coordinator_cancel_event",
        args: { p_coordinator_user_account_id: 2, p_event_id: 7 },
      },
    ]);
  });

  it("AC1: reads an event that is not the coordinator's as not found", async () => {
    const { client } = fakeClient({
      coordinator_cancel_event: { data: null, error: { code: "CS070", message: "No event" } },
    });

    await expect(
      new SupabaseCoordinatorEventRepository(client).cancelEvent(userAccountId("2"), "7"),
    ).rejects.toBeInstanceOf(CoordinatorEventNotFoundError);
  });

  it("AC2: reads an event that moved on in the meantime as not cancellable, naming its status", async () => {
    const { client } = fakeClient({
      coordinator_cancel_event: {
        data: null,
        error: { code: "CS076", message: "cannot be cancelled", details: "Completed" },
      },
    });

    await expect(
      new SupabaseCoordinatorEventRepository(client).cancelEvent(userAccountId("2"), "7"),
    ).rejects.toThrow(new EventNotCancellableError("Completed"));
  });

  it("never calls the database with an id it could not have issued", async () => {
    const { client, calls } = fakeClient({});

    await expect(
      new SupabaseCoordinatorEventRepository(client).cancelEvent(userAccountId("2"), "not-a-key"),
    ).rejects.toBeInstanceOf(CoordinatorEventNotFoundError);
    expect(calls).toEqual([]);
  });
});
