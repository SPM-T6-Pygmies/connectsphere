import { describe, expect, it } from "vitest";

import type { SupabaseAdminClient } from "./client";
import { SupabaseExpiredHoldNotices } from "./supabase-expired-hold-notices";

function fakeClient(answer: { data: unknown; error: { message: string } | null }) {
  const calls: string[] = [];
  const client = {
    rpc: async (name: string) => {
      calls.push(name);
      return answer;
    },
  } as unknown as SupabaseAdminClient;
  return { client, calls };
}

describe("SupabaseExpiredHoldNotices (SPM-254)", () => {
  it("maps each claimed hold to what the notice names", async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          booking_id: 31,
          event_id: 8,
          event_request_id: 6,
          event_name: "Harbour Lights Gala",
          coordinator_user_account_id: 3,
          venue_location: "Grand Ballroom",
          hold_expires_at: "2026-11-20T05:00:00+00:00",
          slots: [{ date: "2026-11-20", start: "13:00:00", end: "18:00:00" }],
        },
      ],
      error: null,
    });

    expect(await new SupabaseExpiredHoldNotices(client).claim()).toEqual([
      {
        bookingId: "31",
        eventId: "8",
        eventRequestId: "6",
        eventName: "Harbour Lights Gala",
        coordinatorUserAccountId: "3",
        venueLocation: "Grand Ballroom",
        times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
        holdExpiresAt: "2026-11-20T05:00:00+00:00",
      },
    ]);
    expect(calls).toEqual(["claim_expired_hold_notices"]);
  });

  it("keeps an event with no request or no coordinator as null", async () => {
    const { client } = fakeClient({
      data: [
        {
          booking_id: 31,
          event_id: 8,
          event_request_id: null,
          event_name: "Harbour Lights Gala",
          coordinator_user_account_id: null,
          venue_location: "Grand Ballroom",
          hold_expires_at: "2026-11-20T05:00:00+00:00",
          slots: [],
        },
      ],
      error: null,
    });

    const [hold] = await new SupabaseExpiredHoldNotices(client).claim();

    expect(hold.eventRequestId).toBeNull();
    expect(hold.coordinatorUserAccountId).toBeNull();
  });

  it("throws when the claim fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });

    await expect(new SupabaseExpiredHoldNotices(client).claim()).rejects.toThrow(
      "Failed to claim expired hold notices: boom",
    );
  });
});
