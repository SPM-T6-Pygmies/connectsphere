import { describe, expect, it } from "vitest";

import { venueId } from "@/core/domain/venue";
import type { UpcomingVenueBookings } from "@/core/ports/outbound/upcoming-venue-bookings";

import type { SupabaseServerClient } from "./client";
import { SupabaseUpcomingVenueBookings } from "./supabase-upcoming-venue-bookings";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return result;
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

/** Used through the port, whose method also takes the time the in-memory store judges by. */
const adapter = (client: SupabaseServerClient): UpcomingVenueBookings => new SupabaseUpcomingVenueBookings(client);

const NOW = new Date("2026-12-14T10:00:00+08:00");

describe("SupabaseUpcomingVenueBookings (SPM-23 AC5)", () => {
  it("asks the database about that venue and says yes when it does", async () => {
    const { client, calls } = fakeClient({ data: true, error: null });

    expect(await adapter(client).hasUpcomingBooking(venueId("5"), NOW)).toBe(true);
    expect(calls).toEqual([{ name: "venue_has_upcoming_booking", args: { p_venue_id: 5 } }]);
  });

  it("says no when the database does", async () => {
    const { client } = fakeClient({ data: false, error: null });

    expect(await adapter(client).hasUpcomingBooking(venueId("5"), NOW)).toBe(false);
  });

  it("says no when the database gives no answer, rather than refusing on a guess", async () => {
    const { client } = fakeClient({ data: null, error: null });

    expect(await adapter(client).hasUpcomingBooking(venueId("5"), NOW)).toBe(false);
  });

  it("says no, without asking, for a venue id this store never issued", async () => {
    const { client, calls } = fakeClient({ data: true, error: null });

    expect(await adapter(client).hasUpcomingBooking(venueId("venue-1"), NOW)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("fails on a database error, never answering no, so a refusal is not skipped by a fault", async () => {
    const { client } = fakeClient({ data: null, error: { message: "permission denied" } });

    await expect(adapter(client).hasUpcomingBooking(venueId("5"), NOW)).rejects.toThrow(
      "permission denied",
    );
  });
});
