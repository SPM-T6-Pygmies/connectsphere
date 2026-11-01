import { describe, expect, it } from "vitest";

import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import { SupabaseConfirmationLapses } from "./supabase-confirmation-lapses";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return answers[name] ?? { data: null, error: { message: `unexpected call to ${name}` } };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

describe("SupabaseConfirmationLapses (SPM-111)", () => {
  it("AC2: reads back each lapsed event with what it lacks, through confirmation_lapses", async () => {
    const { client, calls } = fakeClient({
      confirmation_lapses: {
        data: [
          {
            event_id: 1,
            event_name: "Operations Roadmap Conference",
            event_request_id: 6,
            owning_organiser_user_account_id: 9,
            lapsed: [
              { kind: "arrangement", type: "venue" },
              { kind: "equipment", equipment_type: "Projector" },
              { kind: "flagged-booking", venue_location: "Main Hall" },
              { kind: "safety-check" },
            ],
          },
        ],
        error: null,
      },
    });

    const lapses = await new SupabaseConfirmationLapses(client).causedBy(userAccountId("4"), "venue-unavailable", "31");

    expect(lapses).toEqual([
      {
        eventId: "1",
        eventName: "Operations Roadmap Conference",
        eventRequestId: "6",
        owningOrganiserUserAccountId: "9",
        lapsed: [
          { kind: "arrangement", type: "venue" },
          { kind: "equipment", equipmentType: "Projector" },
          { kind: "flagged-booking", venueLocation: "Main Hall" },
          { kind: "safety-check" },
        ],
      },
    ]);
    expect(calls).toEqual([
      {
        name: "confirmation_lapses",
        args: { p_reader_user_account_id: 4, p_cause: "venue-unavailable", p_source_ref: "31" },
      },
    ]);
  });

  it("reads nothing for a reader id this store never issued", async () => {
    const { client, calls } = fakeClient({});

    expect(await new SupabaseConfirmationLapses(client).causedBy(userAccountId("x"), "change-request", "4")).toEqual([]);
    expect(calls).toEqual([]);
  });
});
