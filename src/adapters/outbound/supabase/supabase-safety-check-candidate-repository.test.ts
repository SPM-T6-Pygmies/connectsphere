import { describe, expect, it } from "vitest";

import { NotSafetyOfficerError } from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import { SupabaseSafetyCheckCandidateRepository } from "./supabase-safety-check-candidate-repository";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const calls: string[] = [];
  const client = {
    rpc: async (name: string) => {
      calls.push(name);
      return answers[name] ?? { data: [], error: null };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

describe("SupabaseSafetyCheckCandidateRepository, lapsed holds (SPM-253)", () => {
  it("marks lapsed holds Expired before it lists the events, so one cannot hold a Confirmed event back (AC1, AC4)", async () => {
    const { client, calls } = fakeClient({ safety_officer_safety_check_candidates: { data: [], error: null } });

    await new SupabaseSafetyCheckCandidateRepository(client).candidates(userAccountId("5"));

    expect(calls).toEqual(["expire_lapsed_holds", "safety_officer_safety_check_candidates"]);
  });

  it("does not sweep for an id this store never issued", async () => {
    const { client, calls } = fakeClient({});

    await expect(
      new SupabaseSafetyCheckCandidateRepository(client).candidates(userAccountId("not-a-number")),
    ).rejects.toBeInstanceOf(NotSafetyOfficerError);
    expect(calls).toEqual([]);
  });
});
