import { describe, expect, it } from "vitest";

import {
  UnavailabilityAlreadyLiftedError,
  VenueNotFoundError,
  VenueUnavailabilityNotFoundError,
  VenueUnavailabilityNotPermittedError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type { VenueUnavailabilityBlock } from "@/core/domain/venue-unavailability";

import type { SupabaseServerClient } from "./client";
import { SupabaseVenueUnavailabilityRepository } from "./supabase-venue-unavailability-repository";
import type { VenueUnavailabilityRow } from "./venue-unavailability-mapper";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

/** A client whose `rpc` answers from a table of function name to result, and remembers the calls. */
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

const STAFF = userAccountId("4");

const BLOCK: VenueUnavailabilityBlock = {
  venueId: venueId("5"),
  startDate: "2026-10-19",
  endDate: "2026-10-19",
  reason: "Renovation",
  note: null,
  slots: [
    { date: "2026-10-19", slot: "AM" },
    { date: "2026-10-19", slot: "PM" },
  ],
};

const ROW: VenueUnavailabilityRow = {
  id: 12,
  venue_id: 5,
  venue_location: "Grand Hall",
  reason_category: "Renovation",
  reason_note: null,
  status: "In force",
  recorded_by_name: "Test Venue Staff",
  recorded_at: "2026-10-05T04:00:00Z",
  lifted_by_name: null,
  lifted_at: null,
  start_date: "2026-10-19",
  end_date: "2026-10-19",
  slots: [
    { date: "2026-10-19", slot: "AM" },
    { date: "2026-10-19", slot: "PM" },
  ],
};

describe("SupabaseVenueUnavailabilityRepository (SPM-268)", () => {
  it("AC1: maps a record result to the stored block, reading it back", async () => {
    const { client, calls } = fakeClient({
      venue_staff_record_unavailability: { data: 12, error: null },
      venue_staff_unavailability: { data: [ROW], error: null },
    });

    const entry = await new SupabaseVenueUnavailabilityRepository(client).record(BLOCK, STAFF);

    expect(entry).toMatchObject({
      id: "12",
      venueLocation: "Grand Hall",
      status: "In force",
      reason: "Renovation",
      recordedByName: "Test Venue Staff",
    });
    expect(entry.slots).toEqual(BLOCK.slots);
    expect(calls[0]).toEqual({
      name: "venue_staff_record_unavailability",
      args: {
        p_staff_user_account_id: 4,
        p_venue_id: 5,
        p_reason: "Renovation",
        p_note: null,
        p_slots: BLOCK.slots,
      },
    });
    expect(calls[1].args).toEqual({ p_staff_user_account_id: 4, p_unavailability_id: 12 });
  });

  it("AC9: maps a refusal of a caller who is not Venue Staff to the domain error", async () => {
    const { client } = fakeClient({
      venue_staff_record_unavailability: { data: null, error: { code: "CS036", message: "no" } },
      venue_staff_lift_unavailability: { data: null, error: { code: "CS036", message: "no" } },
    });
    const repository = new SupabaseVenueUnavailabilityRepository(client);

    await expect(repository.record(BLOCK, STAFF)).rejects.toBeInstanceOf(VenueUnavailabilityNotPermittedError);
    await expect(
      repository.lift({ id: "12", liftedBy: STAFF, liftedAt: new Date() }),
    ).rejects.toBeInstanceOf(VenueUnavailabilityNotPermittedError);
  });

  it("AC1: maps a venue that is not in the catalogue to the domain error", async () => {
    const { client } = fakeClient({
      venue_staff_record_unavailability: { data: null, error: { code: "CS039", message: "no venue" } },
    });

    await expect(new SupabaseVenueUnavailabilityRepository(client).record(BLOCK, STAFF)).rejects.toBeInstanceOf(
      VenueNotFoundError,
    );
  });

  it("AC17: maps a block already lifted, and one that does not exist, to their domain errors", async () => {
    const lift = { id: "12", liftedBy: STAFF, liftedAt: new Date() };
    const already = fakeClient({
      venue_staff_lift_unavailability: { data: null, error: { code: "CS038", message: "already" } },
    });
    const missing = fakeClient({
      venue_staff_lift_unavailability: { data: null, error: { code: "CS037", message: "missing" } },
    });

    await expect(new SupabaseVenueUnavailabilityRepository(already.client).lift(lift)).rejects.toBeInstanceOf(
      UnavailabilityAlreadyLiftedError,
    );
    await expect(new SupabaseVenueUnavailabilityRepository(missing.client).lift(lift)).rejects.toBeInstanceOf(
      VenueUnavailabilityNotFoundError,
    );
  });

  it("AC1: an unrecognised database error is a failure, not a domain error", async () => {
    const { client } = fakeClient({
      venue_staff_record_unavailability: { data: null, error: { code: "XX000", message: "boom" } },
    });

    await expect(new SupabaseVenueUnavailabilityRepository(client).record(BLOCK, STAFF)).rejects.toThrow(
      /Failed to record the block: boom/,
    );
  });

  it("AC16: maps a lifted block with who and when", async () => {
    const { client } = fakeClient({
      venue_staff_unavailability: {
        data: [{ ...ROW, status: "Lifted", lifted_by_name: "Second Venue Staff", lifted_at: "2026-10-06T01:00:00Z" }],
        error: null,
      },
    });

    const [entry] = await new SupabaseVenueUnavailabilityRepository(client).list(STAFF);

    expect(entry).toMatchObject({
      status: "Lifted",
      liftedByName: "Second Venue Staff",
      liftedAt: "2026-10-06T01:00:00Z",
    });
  });

  it("AC11: maps the affected bookings (event, date, slot)", async () => {
    const { client } = fakeClient({
      venue_staff_unavailability_affected: {
        data: [{ booking_id: 1, event_name: "Gala", status: "Confirmed", date: "2026-10-19", slot: "PM" }],
        error: null,
      },
    });

    const affected = await new SupabaseVenueUnavailabilityRepository(client).affectedBookings(
      STAFF,
      venueId("5"),
      BLOCK.slots,
    );

    expect(affected).toEqual([
      { bookingId: "1", eventName: "Gala", status: "Confirmed", date: "2026-10-19", slot: "PM" },
    ]);
  });
});
