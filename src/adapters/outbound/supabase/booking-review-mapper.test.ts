import { describe, expect, it } from "vitest";

import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type { BookingId, DecidedBooking } from "@/core/domain/booking";

import {
  toBookingForReview,
  toDecideBookingArgs,
  type BookingReviewRow,
} from "./booking-review-mapper";

const row: BookingReviewRow = {
  booking_id: 7,
  status: "Requested",
  venue_id: 3,
  venue_location: "Hall A",
  room_layout_name: "Theatre",
  slots: [{ date: "2026-10-22", slot: "AM" }],
  requested_by_name: "Nadia",
  requested_at: "2026-10-01T00:00:00Z",
  decided_by_name: null,
  hold_expires_at: null,
  rejection_note: null,
  suggested_alternative_location: null,
  event: {
    name: "Summit",
    status: "Planning",
    organisation_name: "Org",
    category: null,
    preferred_date: "2026-10-22",
    slots: [],
    expected_attendance: 100,
    room_layout_preference: "Theatre",
    accessibility_requirements: null,
    venue_requirements: null,
    equipment_requirements: null,
    special_arrangements: null,
  },
};

describe("booking review mapper (SPM-22)", () => {
  it("reads a booking for review", () => {
    expect(toBookingForReview(row)).toMatchObject({
      id: "7",
      status: "Requested",
      venueId: "3",
      venueLocation: "Hall A",
      slots: [{ date: "2026-10-22", slot: "AM" }],
      event: { name: "Summit", organisationName: "Org", expectedAttendance: 100 },
    });
  });

  it("reads the event's own slots apart from the slots the booking holds", () => {
    const review = toBookingForReview({
      ...row,
      event: {
        ...row.event,
        slots: [
          { date: "2026-10-22", slot: "AM" },
          { date: "2026-10-23", slot: "Night" },
        ],
      },
    });

    expect(review.slots).toEqual([{ date: "2026-10-22", slot: "AM" }]);
    expect(review.event.slots).toEqual([
      { date: "2026-10-22", slot: "AM" },
      { date: "2026-10-23", slot: "Night" },
    ]);
  });

  it("refuses a status or slot the schema does not allow", () => {
    expect(() => toBookingForReview({ ...row, status: "Maybe" })).toThrow();
    expect(() =>
      toBookingForReview({ ...row, slots: [{ date: "2026-10-22", slot: "Evening" }] }),
    ).toThrow();
  });

  it("carries a held booking's expiry to Venue Staff (SPM-218)", () => {
    expect(
      toBookingForReview({ ...row, status: "Tentative Hold", hold_expires_at: "2026-10-04T01:00:00Z" }),
    ).toMatchObject({ status: "Tentative Hold", holdExpiresAt: "2026-10-04T01:00:00Z" });
    expect(toBookingForReview(row).holdExpiresAt).toBeNull();
  });

  const decided = (overrides: Partial<DecidedBooking> = {}): DecidedBooking => ({
    id: "7" as BookingId,
    status: "Rejected",
    decidedBy: userAccountId("2"),
    rejectionNote: "Closed",
    suggestedAlternative: venueId("4"),
    ...overrides,
  });

  it("sends a rejection with its reason and suggestion", () => {
    expect(toDecideBookingArgs(decided())).toEqual({
      p_staff_user_account_id: 2,
      p_booking_id: 7,
      p_decision: "reject",
      p_note: "Closed",
      p_suggested_alternative_venue_id: 4,
    });
  });

  it("sends an approval with no note", () => {
    expect(
      toDecideBookingArgs(decided({ status: "Confirmed", rejectionNote: null, suggestedAlternative: null })),
    ).toMatchObject({ p_decision: "approve", p_note: null, p_suggested_alternative_venue_id: null });
  });

  it("sends a hold with its expiry as an instant, and no note or suggestion (SPM-218)", () => {
    expect(
      toDecideBookingArgs(
        decided({
          status: "Tentative Hold",
          rejectionNote: null,
          suggestedAlternative: null,
          holdExpiresAt: new Date("2026-10-04T01:00:00.000Z"),
        }),
      ),
    ).toEqual({
      p_staff_user_account_id: 2,
      p_booking_id: 7,
      p_decision: "hold",
      p_note: null,
      p_suggested_alternative_venue_id: null,
      p_hold_expires_at: "2026-10-04T01:00:00.000Z",
    });
  });

  it("sends no expiry with an approval or a rejection (SPM-218)", () => {
    expect(toDecideBookingArgs(decided({ status: "Confirmed", rejectionNote: null, suggestedAlternative: null }))).not.toHaveProperty("p_hold_expires_at");
    expect(toDecideBookingArgs(decided())).not.toHaveProperty("p_hold_expires_at");
  });

  it("refuses to send a hold that has no expiry, since the core always sets one (SPM-218)", () => {
    expect(() =>
      toDecideBookingArgs(decided({ status: "Tentative Hold", rejectionNote: null, suggestedAlternative: null })),
    ).toThrow(/needs an expiry/);
  });

  it("gives up on an id this store could not have issued", () => {
    expect(toDecideBookingArgs(decided({ id: "booking-1" as BookingId }))).toBeNull();
    expect(toDecideBookingArgs(decided({ suggestedAlternative: venueId("v-x") }))).toBeNull();
  });
});
