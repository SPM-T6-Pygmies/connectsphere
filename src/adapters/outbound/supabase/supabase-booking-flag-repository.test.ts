import { describe, expect, it } from "vitest";

import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import { toEventBookingFlag, toFlaggedBooking } from "./booking-flag-mapper";
import { SupabaseBookingFlagRepository } from "./supabase-booking-flag-repository";
import { SupabaseVenueUnavailabilityRepository } from "./supabase-venue-unavailability-repository";

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

const FLAG_ROW = {
  flag_id: 31,
  booking_id: 812,
  venue_location: "Main Hall",
  status: "Confirmed",
  hold_expires_at: null,
  slots: [{ date: "2026-11-16", slot: "PM" }],
  reason_code: "venue-unavailable",
  detail: "Maintenance: 2026-11-16 13:00 to 18:00",
  flagged_at: "2026-10-20T02:15:00Z",
};

describe("SupabaseBookingFlagRepository (SPM-313)", () => {
  it("AC4: reads the open flags on the coordinator's event through coordinator_event_flags", async () => {
    const { client, calls } = fakeClient({ coordinator_event_flags: { data: [FLAG_ROW], error: null } });

    const flags = await new SupabaseBookingFlagRepository(client).openForEvent(userAccountId("3"), "21");

    expect(flags).toEqual([
      {
        flagId: "31",
        bookingId: "812",
        venueLocation: "Main Hall",
        status: "Confirmed",
        holdExpiresAt: null,
        slots: [{ date: "2026-11-16", slot: "PM" }],
        reasonCode: "venue-unavailable",
        detail: "Maintenance: 2026-11-16 13:00 to 18:00",
        flaggedAt: "2026-10-20T02:15:00Z",
      },
    ]);
    expect(calls).toEqual([
      { name: "coordinator_event_flags", args: { p_coordinator_user_account_id: 3, p_event_id: 21 } },
    ]);
  });

  it("AC4: gives nothing for ids this store could not have issued, without asking the database", async () => {
    const { client, calls } = fakeClient({});

    expect(await new SupabaseBookingFlagRepository(client).openForEvent(userAccountId("abc"), "21")).toEqual([]);
    expect(await new SupabaseBookingFlagRepository(client).openForEvent(userAccountId("3"), "not-an-id")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("AC4: raises the database's failure instead of showing an event with no flags", async () => {
    const { client } = fakeClient({ coordinator_event_flags: { data: null, error: { message: "boom" } } });

    await expect(new SupabaseBookingFlagRepository(client).openForEvent(userAccountId("3"), "21")).rejects.toThrow(
      /Failed to read the event's flags: boom/,
    );
  });

  it("refuses a reason code or status the domain does not know", () => {
    expect(() => toEventBookingFlag({ ...FLAG_ROW, reason_code: "something-else" })).toThrow(/Unknown flag reason/);
    expect(() => toEventBookingFlag({ ...FLAG_ROW, status: "Nonsense" })).toThrow(/Unknown booking status/);
  });

  it("maps a booking with no slots recorded to an empty list", () => {
    expect(toEventBookingFlag({ ...FLAG_ROW, slots: null }).slots).toEqual([]);
  });
});

describe("SupabaseVenueUnavailabilityRepository.flaggedBookings (SPM-313)", () => {
  const STAFF = userAccountId("4");

  it("AC1: maps the bookings a block flagged, with the coordinator to tell", async () => {
    const { client, calls } = fakeClient({
      venue_staff_block_flagged_bookings: {
        data: [
          {
            booking_id: 812,
            event_id: 21,
            event_name: "Flag Test: Tech Summit",
            coordinator_user_account_id: 3,
            venue_location: "Main Hall",
            detail: "Maintenance: 2026-11-16 13:00 to 18:00",
          },
        ],
        error: null,
      },
    });

    const flagged = await new SupabaseVenueUnavailabilityRepository(client).flaggedBookings(STAFF, "7");

    expect(flagged).toEqual([
      {
        bookingId: "812",
        eventId: "21",
        eventName: "Flag Test: Tech Summit",
        coordinatorUserAccountId: "3",
        venueLocation: "Main Hall",
        detail: "Maintenance: 2026-11-16 13:00 to 18:00",
      },
    ]);
    expect(calls).toEqual([
      {
        name: "venue_staff_block_flagged_bookings",
        args: { p_staff_user_account_id: 4, p_unavailability_id: 7 },
      },
    ]);
  });

  it("AC1: keeps an event with no assigned coordinator, with nobody to tell", () => {
    expect(
      toFlaggedBooking({
        booking_id: 1,
        event_id: 2,
        event_name: "Gala",
        coordinator_user_account_id: null,
        venue_location: "Studio",
        detail: "Safety: 2026-11-18 13:00 to 18:00",
      }).coordinatorUserAccountId,
    ).toBeNull();
  });

  it("AC1: gives nothing for ids this store could not have issued", async () => {
    const { client, calls } = fakeClient({});

    expect(
      await new SupabaseVenueUnavailabilityRepository(client).flaggedBookings(userAccountId("abc"), "7"),
    ).toEqual([]);
    expect(await new SupabaseVenueUnavailabilityRepository(client).flaggedBookings(STAFF, "x")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("AC1: raises the database's failure", async () => {
    const { client } = fakeClient({
      venue_staff_block_flagged_bookings: { data: null, error: { message: "boom" } },
    });

    await expect(new SupabaseVenueUnavailabilityRepository(client).flaggedBookings(STAFF, "7")).rejects.toThrow(
      /Failed to read the bookings the block flagged: boom/,
    );
  });
});
