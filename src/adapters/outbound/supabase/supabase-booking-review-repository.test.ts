import { describe, expect, it } from "vitest";

import type { BookingId, DecidedBooking } from "@/core/domain/booking";
import { BookingNotDecidableError, VenueSlotBlockedError, VenueSlotUnavailableError } from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import type { BookingReviewRow } from "./booking-review-mapper";
import { SupabaseBookingReviewRepository } from "./supabase-booking-review-repository";

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

const APPROVED: DecidedBooking = {
  id: "12" as BookingId,
  status: "Confirmed",
  decidedBy: userAccountId("4"),
  rejectionNote: null,
  suggestedAlternative: null,
};

/** Booking 12 at venue 5, on two slots of one day, as venue_staff_bookings returns it. */
const BOOKING_ROW: BookingReviewRow = {
  booking_id: 12,
  status: "Requested",
  venue_id: 5,
  venue_location: "Main Hall",
  room_layout_name: "Theatre",
  slots: [
    { date: "2026-10-22", slot: "AM" },
    { date: "2026-10-22", slot: "PM" },
  ],
  requested_by_name: "Test Coordinator",
  requested_at: "2026-10-01T00:00:00Z",
  decided_by_name: null,
  hold_expires_at: null,
  rejection_note: null,
  suggested_alternative_location: null,
  event: {
    event_id: 1,
    event_request_id: 1,
    coordinator_user_account_id: null,
    name: "Summit",
    status: "Planning",
    organisation_name: null,
    category: null,
    preferred_date: null,
    slots: [],
    expected_attendance: null,
    room_layout_preference: null,
    accessibility_requirements: null,
    venue_requirements: null,
    equipment_requirements: null,
    special_arrangements: null,
  },
};

const REFUSED_OVER_BLOCK = {
  data: null,
  error: { code: "CS028", message: "Venue 5 is blocked for 2026-10-22 PM" },
};

describe("SupabaseBookingReviewRepository, approval over a block (SPM-22)", () => {
  it("maps the decide function's CS028 to the blocked-slot domain error, naming the slot", async () => {
    const { client } = fakeClient({
      venue_staff_decide_booking: REFUSED_OVER_BLOCK,
      venue_staff_bookings: { data: [BOOKING_ROW], error: null },
      venue_blocked_slots: {
        data: [{ venue_id: 5, date: "2026-10-22", slot: "PM", reason_category: "Safety" }],
        error: null,
      },
    });

    const error = await new SupabaseBookingReviewRepository(client)
      .decide(APPROVED)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenueSlotBlockedError);
    expect((error as VenueSlotBlockedError).slots).toEqual([{ date: "2026-10-22", slot: "PM" }]);
    expect((error as VenueSlotBlockedError).message).toContain("2026-10-22 PM");
  });

  it("falls back to the slot the function named when a lift landed in between", async () => {
    const { client } = fakeClient({
      venue_staff_decide_booking: REFUSED_OVER_BLOCK,
      venue_staff_bookings: { data: [BOOKING_ROW], error: null },
      venue_blocked_slots: { data: [], error: null },
    });

    const error = await new SupabaseBookingReviewRepository(client)
      .decide(APPROVED)
      .catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).slots).toEqual([{ date: "2026-10-22", slot: "PM" }]);
  });

  it("still maps CS025 to the slot-taken error, not the blocked one", async () => {
    const { client } = fakeClient({
      venue_staff_decide_booking: {
        data: null,
        error: { code: "CS025", message: "Venue 5 is already booked for 2026-10-22 AM" },
      },
      venue_staff_bookings: { data: [BOOKING_ROW], error: null },
    });

    await expect(new SupabaseBookingReviewRepository(client).decide(APPROVED)).rejects.toBeInstanceOf(
      VenueSlotUnavailableError,
    );
  });
});

describe("SupabaseBookingReviewRepository, placing a hold (SPM-218)", () => {
  const HELD: DecidedBooking = {
    id: "12" as BookingId,
    status: "Tentative Hold",
    decidedBy: userAccountId("4"),
    rejectionNote: null,
    suggestedAlternative: null,
    holdExpiresAt: new Date("2026-10-04T01:00:00.000Z"),
  };

  it("asks the decide function to hold the booking, with the expiry", async () => {
    const { client, calls } = fakeClient({ venue_staff_decide_booking: { data: null, error: null } });

    await new SupabaseBookingReviewRepository(client).decide(HELD);

    expect(calls).toEqual([
      {
        name: "venue_staff_decide_booking",
        args: {
          p_staff_user_account_id: 4,
          p_booking_id: 12,
          p_decision: "hold",
          p_note: null,
          p_suggested_alternative_venue_id: null,
          p_hold_expires_at: "2026-10-04T01:00:00.000Z",
        },
      },
    ]);
  });

  it("maps a clash, a block and a booking no longer waiting the same way an approval does", async () => {
    const refuse = (code: string, message: string) =>
      fakeClient({
        venue_staff_decide_booking: { data: null, error: { code, message } },
        venue_staff_bookings: { data: [BOOKING_ROW], error: null },
      });

    await expect(
      new SupabaseBookingReviewRepository(refuse("CS025", "Venue 5 is already booked for 2026-10-22 AM").client).decide(HELD),
    ).rejects.toBeInstanceOf(VenueSlotUnavailableError);
    await expect(
      new SupabaseBookingReviewRepository(refuse("CS028", "Venue 5 is blocked for 2026-10-22 PM").client).decide(HELD),
    ).rejects.toBeInstanceOf(VenueSlotBlockedError);
    await expect(
      new SupabaseBookingReviewRepository(refuse("CS031", "Booking 12 is already Confirmed").client).decide(HELD),
    ).rejects.toBeInstanceOf(BookingNotDecidableError);
  });
});
