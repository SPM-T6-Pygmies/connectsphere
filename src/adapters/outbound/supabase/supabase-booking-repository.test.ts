import { describe, expect, it } from "vitest";

import type { BookingRequest } from "@/core/domain/booking";
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  VenueSlotBlockedError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";

import type { SupabaseServerClient } from "./client";
import { SupabaseBookingRepository } from "./supabase-booking-repository";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return answers[name] ?? { data: [], error: null };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

const REQUEST: BookingRequest = {
  eventId: "1",
  venueId: venueId("5"),
  roomLayout: "Theatre",
  slots: [
    { date: "2026-10-22", slot: "AM" },
    { date: "2026-10-22", slot: "PM" },
    { date: "2026-10-23", slot: "AM" },
  ],
  requestedBy: userAccountId("2"),
  status: "Requested",
};

const REFUSED_BY_TRIGGER = {
  data: null,
  error: { code: "CS028", message: "Venue 5 is blocked for 2026-10-22 AM" },
};

describe("SupabaseBookingRepository, blocked slots (SPM-270)", () => {
  it("AC12: maps the block trigger's code to a blocked-slot domain error", async () => {
    const { client } = fakeClient({ coordinator_submit_booking_request: REFUSED_BY_TRIGGER });

    await expect(new SupabaseBookingRepository(client).submit(REQUEST)).rejects.toBeInstanceOf(
      VenueSlotBlockedError,
    );
  });

  it("AC12: names every requested slot a block covers, not only the first the trigger hit", async () => {
    const { client, calls } = fakeClient({
      coordinator_submit_booking_request: REFUSED_BY_TRIGGER,
      venue_blocked_slots: {
        data: [
          { venue_id: 5, date: "2026-10-22", slot: "AM", reason_category: "Renovation" },
          { venue_id: 5, date: "2026-10-22", slot: "PM", reason_category: "Safety" },
          { venue_id: 5, date: "2026-10-25", slot: "AM", reason_category: "Safety" },
        ],
        error: null,
      },
    });

    const error = await new SupabaseBookingRepository(client).submit(REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenueSlotBlockedError);
    expect((error as VenueSlotBlockedError).slots).toEqual([
      { date: "2026-10-22", slot: "AM" },
      { date: "2026-10-22", slot: "PM" },
    ]);
    expect((error as VenueSlotBlockedError).message).toContain("2026-10-22 AM, 2026-10-22 PM");
    expect(calls[1]).toEqual({
      name: "venue_blocked_slots",
      args: { p_venue_id: 5, p_from: "2026-10-22", p_to: "2026-10-23" },
    });
  });

  it("AC12: falls back to the slot the trigger named when a lift landed in between", async () => {
    const { client } = fakeClient({
      coordinator_submit_booking_request: REFUSED_BY_TRIGGER,
      venue_blocked_slots: { data: [], error: null },
    });

    const error = await new SupabaseBookingRepository(client).submit(REQUEST).catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).slots).toEqual([{ date: "2026-10-22", slot: "AM" }]);
  });
});

describe("SupabaseBookingRepository, lapsed holds (SPM-253)", () => {
  it("marks lapsed holds Expired before it lists an event's bookings for its coordinator (AC1)", async () => {
    const { client, calls } = fakeClient({ coordinator_event_bookings: { data: [], error: null } });

    await new SupabaseBookingRepository(client).listForEvent(userAccountId("2"), "1");

    expect(calls.map((call) => call.name)).toEqual(["expire_lapsed_holds", "coordinator_event_bookings"]);
  });
});

describe("SupabaseBookingRepository, cancelling a booking (SPM-20)", () => {
  it("asks the database to cancel the booking for this coordinator", async () => {
    const { client, calls } = fakeClient({ coordinator_cancel_booking: { data: null, error: null } });

    await new SupabaseBookingRepository(client).cancel(userAccountId("2"), "12");

    expect(calls).toEqual([
      {
        name: "coordinator_cancel_booking",
        args: { p_coordinator_user_account_id: 2, p_booking_id: 12 },
      },
    ]);
  });

  it("reads a booking that is not on the coordinator's events as not found (AC1)", async () => {
    const { client } = fakeClient({
      coordinator_cancel_booking: { data: null, error: { code: "CS026", message: "No booking" } },
    });

    await expect(
      new SupabaseBookingRepository(client).cancel(userAccountId("2"), "12"),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it("reads a booking that moved on in the meantime as no longer cancellable", async () => {
    const { client } = fakeClient({
      coordinator_cancel_booking: { data: null, error: { code: "CS075", message: "Released" } },
    });

    await expect(
      new SupabaseBookingRepository(client).cancel(userAccountId("2"), "12"),
    ).rejects.toBeInstanceOf(BookingNotCancellableError);
  });

  it("never calls the database with an id it could not have issued", async () => {
    const { client, calls } = fakeClient({});

    await expect(
      new SupabaseBookingRepository(client).cancel(userAccountId("2"), "booking"),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    expect(calls).toEqual([]);
  });
});
