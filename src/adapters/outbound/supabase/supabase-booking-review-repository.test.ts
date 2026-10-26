import { describe, expect, it } from "vitest";

import type { BookingId, DecidedBooking, ResolvedHold } from "@/core/domain/booking";
import {
  BookingNotDecidableError,
  BookingNotFoundError,
  HoldNotLiveError,
  VenuePaddedClashError,
  VenueSlotBlockedError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import type { SupabaseServerClient } from "./client";
import type { BookingReviewRow } from "./booking-review-mapper";
import { SupabaseBookingReviewRepository } from "./supabase-booking-review-repository";

type RpcResult = { data: unknown; error: { code?: string; message: string; details?: string } | null };

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
    { date: "2026-10-22", start: "07:00:00", end: "12:00:00" },
    { date: "2026-10-22", start: "13:00:00", end: "18:00:00" },
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
  error: { code: "CS028", message: "Venue 5 is blocked for 2026-10-22 13:00–13:15" },
};

describe("SupabaseBookingReviewRepository, approval over a block (SPM-22)", () => {
  it("maps the decide function's CS028 to the blocked-slot domain error, naming the blocked hours", async () => {
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
    expect((error as VenueSlotBlockedError).times).toEqual([
      { date: "2026-10-22", start: "13:00", end: "18:00" },
    ]);
    expect((error as VenueSlotBlockedError).message).toContain("2026-10-22 13:00–18:00");
  });

  it("falls back to the time the function named when a lift landed in between", async () => {
    const { client } = fakeClient({
      venue_staff_decide_booking: REFUSED_OVER_BLOCK,
      venue_staff_bookings: { data: [BOOKING_ROW], error: null },
      venue_blocked_slots: { data: [], error: null },
    });

    const error = await new SupabaseBookingReviewRepository(client)
      .decide(APPROVED)
      .catch((e: unknown) => e);

    expect((error as VenueSlotBlockedError).times).toEqual([
      { date: "2026-10-22", start: "13:00", end: "13:15" },
    ]);
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

  it("maps a padded clash, a block and a booking no longer waiting the same way an approval does", async () => {
    const refuse = (code: string, message: string) =>
      fakeClient({
        venue_staff_decide_booking: { data: null, error: { code, message } },
        venue_staff_bookings: { data: [BOOKING_ROW], error: null },
      });

    await expect(
      new SupabaseBookingReviewRepository(
        refuse("CS082", "Venue 5 has another booking within this booking's setup or turnaround time").client,
      ).decide(HELD),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
    await expect(
      new SupabaseBookingReviewRepository(refuse("CS028", "Venue 5 is blocked for 2026-10-22 PM").client).decide(HELD),
    ).rejects.toBeInstanceOf(VenueSlotBlockedError);
    await expect(
      new SupabaseBookingReviewRepository(refuse("CS031", "Booking 12 is already Confirmed").client).decide(HELD),
    ).rejects.toBeInstanceOf(BookingNotDecidableError);
  });
});

describe("SupabaseBookingReviewRepository, confirming or releasing a hold (SPM-219)", () => {
  const confirmed: ResolvedHold = { id: "12" as BookingId, status: "Confirmed", resolvedBy: userAccountId("4") };
  const released: ResolvedHold = { ...confirmed, status: "Released" };

  it("asks the resolve function to confirm or release the booking", async () => {
    const { client, calls } = fakeClient({ venue_staff_resolve_hold: { data: null, error: null } });
    const repository = new SupabaseBookingReviewRepository(client);

    await repository.resolveHold(confirmed);
    await repository.resolveHold(released);

    expect(calls).toEqual([
      { name: "venue_staff_resolve_hold", args: { p_staff_user_account_id: 4, p_booking_id: 12, p_resolution: "confirm" } },
      { name: "venue_staff_resolve_hold", args: { p_staff_user_account_id: 4, p_booking_id: 12, p_resolution: "release" } },
    ]);
  });

  it("maps CS074 to a hold that is no longer live, and CS030 to not found (AC4)", async () => {
    const refuse = (code: string) =>
      new SupabaseBookingReviewRepository(
        fakeClient({ venue_staff_resolve_hold: { data: null, error: { code, message: "refused" } } }).client,
      );

    await expect(refuse("CS074").resolveHold(confirmed)).rejects.toBeInstanceOf(HoldNotLiveError);
    await expect(refuse("CS030").resolveHold(released)).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it("maps CS028 to a blocked-slot error naming the slot, for a confirmation over a block (AC7)", async () => {
    const { client } = fakeClient({
      venue_staff_resolve_hold: { data: null, error: { code: "CS028", message: "Venue 5 is blocked for 2026-10-22 PM" } },
      venue_staff_bookings: { data: [BOOKING_ROW], error: null },
    });

    await expect(new SupabaseBookingReviewRepository(client).resolveHold(confirmed)).rejects.toBeInstanceOf(
      VenueSlotBlockedError,
    );
  });

  it("surfaces any other fault as a genuine error", async () => {
    const { client } = fakeClient({ venue_staff_resolve_hold: { data: null, error: { code: "XX000", message: "boom" } } });

    await expect(new SupabaseBookingReviewRepository(client).resolveHold(confirmed)).rejects.toThrow(
      "Failed to resolve the hold: boom",
    );
  });
});

describe("SupabaseBookingReviewRepository, lapsed holds (SPM-253)", () => {
  it("marks lapsed holds Expired before it lists or opens a booking (AC1)", async () => {
    const { client, calls } = fakeClient({ venue_staff_bookings: { data: [BOOKING_ROW], error: null } });
    const repository = new SupabaseBookingReviewRepository(client);

    await repository.list(userAccountId("4"), "archive");
    await repository.find(userAccountId("4"), "12" as BookingId);

    expect(calls.map((call) => call.name)).toEqual([
      "expire_lapsed_holds",
      "venue_staff_bookings",
      "expire_lapsed_holds",
      "venue_staff_bookings",
    ]);
  });

  it("reads nothing when the sweep itself fails (AC1)", async () => {
    const { client, calls } = fakeClient({
      expire_lapsed_holds: { data: null, error: { code: "XX000", message: "boom" } },
    });

    await expect(new SupabaseBookingReviewRepository(client).list(userAccountId("4"), "decided")).rejects.toThrow(
      "Failed to expire lapsed holds: boom",
    );
    expect(calls.map((call) => call.name)).toEqual(["expire_lapsed_holds"]);
  });
});

describe("SupabaseBookingReviewRepository, padded clashes (SPM-19)", () => {
  const PADDED_CLASH = {
    data: null,
    error: {
      code: "CS082",
      message: "Venue 5 has another booking within this booking's setup or turnaround time",
      details: JSON.stringify([{ event: "Charity Run", date: "2026-12-14", start: "09:30", end: "10:00" }]),
    },
  };

  it("AC1: maps CS082 to the padded-clash error, naming the event, date and times from the detail", async () => {
    const { client } = fakeClient({ venue_staff_decide_booking: PADDED_CLASH });

    const error = await new SupabaseBookingReviewRepository(client).decide(APPROVED).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenuePaddedClashError);
    expect((error as VenuePaddedClashError).clashes).toEqual([
      { eventName: "Charity Run", date: "2026-12-14", start: "09:30", end: "10:00", hold: null },
    ]);
  });

  it("AC4: carries the hold, and when it expires, when the booking in the way is a Tentative Hold", async () => {
    const { client } = fakeClient({
      venue_staff_decide_booking: {
        data: null,
        error: {
          code: "CS082",
          message: "Venue 5 has another booking within this booking's setup or turnaround time",
          details: JSON.stringify([
            { event: "Quiz Night", date: "2026-12-15", start: "09:30", end: "10:00", holdExpiresAt: "2026-11-24T06:30:00+00:00" },
          ]),
        },
      },
    });

    const error = await new SupabaseBookingReviewRepository(client).decide(APPROVED).catch((e: unknown) => e);

    expect((error as VenuePaddedClashError).clashes).toEqual([
      { eventName: "Quiz Night", date: "2026-12-15", start: "09:30", end: "10:00", hold: { expiresAt: "2026-11-24T06:30:00+00:00" } },
    ]);
    expect((error as VenuePaddedClashError).message).toContain("already temporarily reserved (held), the hold expires on 2026-11-24 14:30 (Singapore time)");
  });

  it("AC3: maps it the same way when placing a hold", async () => {
    const { client } = fakeClient({ venue_staff_decide_booking: PADDED_CLASH });

    await expect(
      new SupabaseBookingReviewRepository(client).decide({
        ...APPROVED,
        status: "Tentative Hold",
        holdExpiresAt: new Date("2026-12-10T01:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
  });
});
