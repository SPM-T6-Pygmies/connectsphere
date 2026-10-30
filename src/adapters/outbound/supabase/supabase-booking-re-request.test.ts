import { describe, expect, it } from "vitest";

import type { BookingId, BookingRequest, DecidedBooking } from "@/core/domain/booking";
import {
  BookingNotFoundError,
  NoFlagToReRequestError,
  ReRequestNotHoldableError,
  ReRequestPendingError,
  VenueSlotUnavailableError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";

import { toEventBookingSummary, toOccupiedTime, toSubmitBookingArgs, type EventBookingRow } from "./booking-mapper";
import { toBookingForReview, type BookingReviewRow } from "./booking-review-mapper";
import type { SupabaseServerClient } from "./client";
import { SupabaseBookingRepository } from "./supabase-booking-repository";
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

/** A re-request for booking 12, at venue 5 from 13:00 to 13:30. */
const RE_REQUEST: BookingRequest = {
  eventId: "1",
  venueId: venueId("5"),
  roomLayout: "Theatre",
  times: [{ date: "2026-11-16", start: "13:00", end: "13:30" }],
  requestedBy: userAccountId("2"),
  status: "Requested",
  replacesBookingId: "12" as BookingId,
};

const refused = (code: string): RpcResult => ({ data: null, error: { code, message: "refused" } });

describe("Supabase adapters for re-requesting a flagged booking (SPM-251)", () => {
  it("AC4: sends the booking a re-request replaces with the ordinary request", () => {
    expect(toSubmitBookingArgs(RE_REQUEST)).toMatchObject({ p_event_id: 1, p_venue_id: 5, p_replaces_booking_id: 12 });
    expect(toSubmitBookingArgs({ ...RE_REQUEST, replacesBookingId: null })?.p_replaces_booking_id).toBeNull();
  });

  it("AC1: never sends a replaced booking id the database could not have issued", () => {
    expect(toSubmitBookingArgs({ ...RE_REQUEST, replacesBookingId: "booking-x" as BookingId })).toBeNull();
  });

  it("AC1: reads CS085 as no open flag to re-request, and CS026 as the booking not found", async () => {
    await expect(
      new SupabaseBookingRepository(fakeClient({ coordinator_submit_booking_request: refused("CS085") }).client).submit(RE_REQUEST),
    ).rejects.toBeInstanceOf(NoFlagToReRequestError);
    await expect(
      new SupabaseBookingRepository(fakeClient({ coordinator_submit_booking_request: refused("CS026") }).client).submit(RE_REQUEST),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it("AC9: reads CS086 as a re-request already waiting, the answer for the tab that lost the race", async () => {
    await expect(
      new SupabaseBookingRepository(fakeClient({ coordinator_submit_booking_request: refused("CS086") }).client).submit(RE_REQUEST),
    ).rejects.toBeInstanceOf(ReRequestPendingError);
  });

  it("AC5: a clash it names leaves out the booking being replaced", async () => {
    const { client } = fakeClient({
      coordinator_submit_booking_request: refused("CS025"),
      venue_booked_slots: {
        data: [
          { booking_id: 12, slot_date: "2026-11-16", start_time: "13:00:00", end_time: "13:15:00", status: "Confirmed", hold_expires_at: null },
          { booking_id: 40, slot_date: "2026-11-16", start_time: "13:15:00", end_time: "13:30:00", status: "Confirmed", hold_expires_at: null },
        ],
        error: null,
      },
    });

    const error = await new SupabaseBookingRepository(client).submit(RE_REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenueSlotUnavailableError);
    expect((error as VenueSlotUnavailableError).times).toEqual([{ date: "2026-11-16", start: "13:15", end: "13:30" }]);
  });

  it("AC10: reads CS087 as a re-request that cannot be held", async () => {
    const hold: DecidedBooking = {
      id: "30" as BookingId,
      status: "Tentative Hold",
      decidedBy: userAccountId("4"),
      rejectionNote: null,
      suggestedAlternative: null,
      holdExpiresAt: new Date("2026-10-29T09:00:00+08:00"),
    };
    const { client } = fakeClient({ venue_staff_decide_booking: refused("CS087") });

    await expect(new SupabaseBookingReviewRepository(client).decide(hold)).rejects.toBeInstanceOf(ReRequestNotHoldableError);
  });

  it("AC4: reads the booking a re-request replaces for Venue Staff, and nothing for an ordinary one", () => {
    const row = {
      booking_id: 30,
      status: "Requested",
      venue_id: 6,
      venue_location: "Studio",
      room_layout_name: null,
      slots: [{ date: "2026-11-16", start: "13:00:00", end: "13:15:00" }],
      requested_by_name: "Test Coordinator",
      requested_at: "2026-10-26T00:00:00Z",
      decided_by_name: null,
      hold_expires_at: null,
      rejection_note: null,
      suggested_alternative_location: null,
      replaces: {
        booking_id: 12,
        venue_location: "Main Hall",
        status: "Confirmed",
        slots: [
          { date: "2026-11-16", start: "13:00:00", end: "13:15:00" },
          { date: "2026-11-16", start: "13:15:00", end: "13:30:00" },
        ],
      },
      event: { event_id: 1, event_request_id: null, coordinator_user_account_id: 2, name: "Tech Summit", status: "Planning", organisation_name: null, category: null, preferred_date: null, slots: [], expected_attendance: null, room_layout_preference: null, accessibility_requirements: null, venue_requirements: null, equipment_requirements: null, special_arrangements: null },
    } satisfies BookingReviewRow;

    expect(toBookingForReview(row).replaces).toEqual({
      id: "12",
      venueLocation: "Main Hall",
      status: "Confirmed",
      times: [{ date: "2026-11-16", start: "13:00", end: "13:30" }],
    });
    expect(toBookingForReview({ ...row, replaces: null }).replaces).toBeNull();
  });

  it("AC6: reads both links on the coordinator's bookings, and which booking holds a slot", () => {
    const row: EventBookingRow = {
      booking_id: 12,
      venue_id: 5,
      venue_location: "Main Hall",
      room_layout_name: null,
      status: "Released",
      hold_expires_at: null,
      created_at: "2026-10-01T00:00:00Z",
      slots: [],
      rejection_note: null,
      suggested_alternative_venue_id: null,
      suggested_alternative_location: null,
      replaces_booking_id: 3,
      replaced_by_booking_id: 30,
    };

    expect(toEventBookingSummary(row)).toMatchObject({ replacesBookingId: "3", replacedByBookingId: "30" });
    expect(
      toOccupiedTime({ booking_id: 12, slot_date: "2026-11-16", start_time: "13:00:00", end_time: "13:15:00", status: "Confirmed", hold_expires_at: null }).bookingId,
    ).toBe("12");
  });
});
