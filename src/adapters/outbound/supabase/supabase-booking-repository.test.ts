import { describe, expect, it } from "vitest";

import type { BookingRequest } from "@/core/domain/booking";
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  CancelledEventBookingError,
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
  times: [
    { date: "2026-10-22", start: "07:00", end: "12:00" },
    { date: "2026-10-22", start: "13:00", end: "18:00" },
    { date: "2026-10-23", start: "07:00", end: "12:00" },
  ],
  requestedBy: userAccountId("2"),
  status: "Requested",
};

const REFUSED_BY_TRIGGER = {
  data: null,
  error: { code: "CS028", message: "Venue 5 is blocked for 2026-10-22 07:00–07:15" },
};

describe("SupabaseBookingRepository, blocked slots (SPM-270)", () => {
  it("AC12: maps the block trigger's code to a blocked-slot domain error", async () => {
    const { client } = fakeClient({ coordinator_submit_booking_request: REFUSED_BY_TRIGGER });

    await expect(new SupabaseBookingRepository(client).submit(REQUEST)).rejects.toBeInstanceOf(
      VenueSlotBlockedError,
    );
  });

  it("AC12: names every block hour that reaches the request, not only the first the trigger hit", async () => {
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
    expect((error as VenueSlotBlockedError).times).toEqual([
      { date: "2026-10-22", start: "07:00", end: "12:00" },
      { date: "2026-10-22", start: "13:00", end: "18:00" },
    ]);
    expect((error as VenueSlotBlockedError).message).toContain(
      "2026-10-22 07:00–12:00, 2026-10-22 13:00–18:00",
    );
    expect(calls[1]).toEqual({
      name: "venue_blocked_slots",
      args: { p_venue_id: 5, p_from: "2026-10-22", p_to: "2026-10-23" },
    });
  });

  it("names the shared time, 09:00 to 11:30, for a request on AM, once however many blocks hold it (SPM-321)", async () => {
    const quarters = Array.from({ length: 10 }, (_, i) => ({
      venue_id: 5,
      date: "2026-10-22",
      slot: String(36 + i),
      reason_category: "Renovation",
    }));
    const { client } = fakeClient({
      coordinator_submit_booking_request: REFUSED_BY_TRIGGER,
      // Two blocks hold the same quarter hours, so the read gives each row twice.
      venue_blocked_slots: { data: [...quarters, ...quarters], error: null },
    });

    const error = await new SupabaseBookingRepository(client).submit(REQUEST).catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).times).toEqual([{ date: "2026-10-22", start: "09:00", end: "11:30" }]);
    expect((error as VenueSlotBlockedError).message).toContain("2026-10-22 09:00–11:30");
  });

  it("AC12: falls back to the time the trigger named when a lift landed in between", async () => {
    const { client } = fakeClient({
      coordinator_submit_booking_request: REFUSED_BY_TRIGGER,
      venue_blocked_slots: { data: [], error: null },
    });

    const error = await new SupabaseBookingRepository(client).submit(REQUEST).catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).times).toEqual([
      { date: "2026-10-22", start: "07:00", end: "07:15" },
    ]);
  });
});

describe("SupabaseBookingRepository, a cancelled event (SPM-55)", () => {
  it("AC6: reads an event cancelled since the use case looked as cancelled", async () => {
    const { client } = fakeClient({
      coordinator_submit_booking_request: {
        data: null,
        error: { code: "CS077", message: "Event 1 is cancelled" },
      },
    });

    await expect(new SupabaseBookingRepository(client).submit(REQUEST)).rejects.toBeInstanceOf(
      CancelledEventBookingError,
    );
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
