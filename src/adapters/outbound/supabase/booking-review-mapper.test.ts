import { describe, expect, it } from "vitest";

import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type { BookingId, DecidedBooking } from "@/core/domain/booking";

import {
  toBookingForReview,
  toDecideBookingArgs,
  toResolveHoldArgs,
  type BookingReviewRow,
} from "./booking-review-mapper";

const row: BookingReviewRow = {
  booking_id: 7,
  status: "Requested",
  venue_id: 3,
  venue_location: "Hall A",
  room_layout_name: "Theatre",
  slots: [{ date: "2026-10-22", start: "07:00:00", end: "12:00:00" }],
  requested_by_name: "Nadia",
  requested_at: "2026-10-01T00:00:00Z",
  decided_by_name: null,
  hold_expires_at: null,
  rejection_note: null,
  suggested_alternative_location: null,
  event: {
    event_id: 12,
    event_request_id: 6,
    coordinator_user_account_id: 3,
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
      times: [{ date: "2026-10-22", start: "07:00", end: "12:00" }],
      event: { name: "Summit", organisationName: "Org", expectedAttendance: 100 },
    });
  });

  it("reads the event's own times apart from the slots the booking holds", () => {
    const review = toBookingForReview({
      ...row,
      event: {
        ...row.event,
        slots: [
          { date: "2026-10-22", start: "07:00:00", end: "07:15:00" },
          { date: "2026-10-23", start: "19:00:00", end: "19:15:00" },
        ],
      },
    });

    expect(review.times).toEqual([{ date: "2026-10-22", start: "07:00", end: "12:00" }]);
    expect(review.event.times).toEqual([
      { date: "2026-10-22", start: "07:00", end: "07:15" },
      { date: "2026-10-23", start: "19:00", end: "19:15" },
    ]);
  });

  it("refuses a status the schema does not allow", () => {
    expect(() => toBookingForReview({ ...row, status: "Maybe" })).toThrow();
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

describe("booking review mapper (SPM-62)", () => {
  it("reads the event's ids and its assigned coordinator, so a decision can tell them", () => {
    expect(toBookingForReview(row).event).toMatchObject({
      id: "12",
      requestId: "6",
      coordinatorUserAccountId: "3",
    });
  });

  it("reads an event with no request and no coordinator as null, not as \"null\"", () => {
    const review = toBookingForReview({
      ...row,
      event: { ...row.event, event_request_id: null, coordinator_user_account_id: null },
    });

    expect(review.event).toMatchObject({ requestId: null, coordinatorUserAccountId: null });
  });
});

describe("booking review mapper -- resolving a hold (SPM-219)", () => {
  const resolved = (status: "Confirmed" | "Released", staff = "2", booking = "7") => ({
    id: booking as BookingId,
    status,
    resolvedBy: userAccountId(staff),
  });

  it("sends a confirmation and a release as the function's two resolutions", () => {
    expect(toResolveHoldArgs(resolved("Confirmed"))).toEqual({
      p_staff_user_account_id: 2,
      p_booking_id: 7,
      p_resolution: "confirm",
    });
    expect(toResolveHoldArgs(resolved("Released"))).toMatchObject({ p_resolution: "release" });
  });

  it("is null when an id is not one this store issued", () => {
    expect(toResolveHoldArgs(resolved("Confirmed", "not-a-number"))).toBeNull();
    expect(toResolveHoldArgs(resolved("Released", "2", "nope"))).toBeNull();
  });
});

describe("toBookingForReview reading booking times (SPM-351)", () => {
  it("joins touching 15-minute slots into the start and end time Venue Staff read (AC4)", () => {
    const review = toBookingForReview({
      ...row,
      slots: [
        { date: "2026-10-22", start: "15:00:00", end: "15:15:00" },
        { date: "2026-10-22", start: "15:15:00", end: "15:30:00" },
        { date: "2026-10-22", start: "17:00:00", end: "17:15:00" },
      ],
    });

    expect(review.times).toEqual([
      { date: "2026-10-22", start: "15:00", end: "15:30" },
      { date: "2026-10-22", start: "17:00", end: "17:15" },
    ]);
  });
});
