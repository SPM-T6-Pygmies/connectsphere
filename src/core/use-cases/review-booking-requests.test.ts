import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryBookingReviewRepository } from "@/adapters/outbound/in-memory/in-memory-booking-review-repository";
import { InMemoryVenueCatalogue } from "@/adapters/outbound/in-memory/in-memory-venue-catalogue";

import type { BookingId, BookingStatus } from "../domain/booking";
import { BookingNotFoundError } from "../domain/errors";
import { venueId } from "../domain/venue";
import type { BookingForReview } from "../ports/outbound/booking-review-repository";
import { ReviewBookingRequestsUseCase } from "./review-booking-requests";

const STAFF = "staff-1";
const NOW = new Date("2026-10-01T09:00:00+08:00");

function booking(status: BookingStatus, holdExpiresAt: string | null): BookingForReview {
  return {
    id: "b1" as BookingId,
    status,
    venueId: venueId("v1"),
    venueLocation: "Venue v1",
    roomLayoutName: null,
    times: [{ date: "2026-10-22", start: "07:00", end: "12:00" }],
    requestedByName: "Coordinator",
    requestedAt: "2026-10-01T00:00:00.000Z",
    decidedByName: null,
    holdExpiresAt,
    rejectionNote: null,
    suggestedAlternativeLocation: null,
    replaces: null,
    event: {
      id: "e1",
      requestId: "r1",
      coordinatorUserAccountId: null,
      name: "Summit",
      status: "Planning",
      organisationName: null,
      category: null,
      preferredDate: null,
      times: [],
      expectedAttendance: null,
      roomLayoutPreference: null,
      accessibilityRequirements: null,
      venueRequirements: null,
      equipmentRequirements: null,
      specialArrangements: null,
    },
  };
}

function lists(rows: BookingForReview[]) {
  return new ReviewBookingRequestsUseCase({
    reviews: new InMemoryBookingReviewRepository(rows, [STAFF]),
    venues: new InMemoryVenueCatalogue(),
    clock: new FixedClock(NOW),
  });
}

function open(row: BookingForReview, staff = STAFF) {
  return new ReviewBookingRequestsUseCase({
    reviews: new InMemoryBookingReviewRepository([row], [STAFF]),
    venues: new InMemoryVenueCatalogue(),
    clock: new FixedClock(NOW),
  }).open(staff, row.id);
}

describe("ReviewBookingRequestsUseCase telling whether a hold can still be resolved (SPM-219)", () => {
  it("a Tentative Hold that has not expired is live (AC1, AC2)", async () => {
    expect((await open(booking("Tentative Hold", "2026-10-03T09:00:00.000Z"))).holdLive).toBe(true);
  });

  it("is live up to the instant it expires, and not at it or after (AC4 boundary)", async () => {
    expect((await open(booking("Tentative Hold", "2026-10-01T01:00:00.001Z"))).holdLive).toBe(true);
    expect((await open(booking("Tentative Hold", "2026-10-01T01:00:00.000Z"))).holdLive).toBe(false);
    expect((await open(booking("Tentative Hold", "2026-10-01T00:59:59.000Z"))).holdLive).toBe(false);
  });

  it("only a hold can be live, whatever else the booking is (AC4)", async () => {
    for (const status of ["Requested", "Confirmed", "Released", "Rejected", "Cancelled"] as const) {
      expect((await open(booking(status, null))).holdLive).toBe(false);
    }
  });

  it("still answers someone who is not Venue Staff as not found", async () => {
    await expect(open(booking("Tentative Hold", "2026-10-03T09:00:00.000Z"), "someone-else")).rejects.toBeInstanceOf(
      BookingNotFoundError,
    );
  });
});

describe("ReviewBookingRequestsUseCase filing an Expired hold (SPM-253)", () => {
  const expired = { ...booking("Expired", "2026-10-01T00:59:59.000Z"), id: "b2" as BookingId };
  const live = booking("Tentative Hold", "2026-10-03T09:00:00.000Z");

  it("an Expired hold is listed under Archive and not under Decided (AC6)", async () => {
    const useCase = lists([live, expired]);

    expect((await useCase.list(STAFF, "archive")).map((row) => row.id)).toEqual(["b2"]);
    expect((await useCase.list(STAFF, "decided")).map((row) => row.id)).toEqual(["b1"]);
  });

  it("an Expired booking is never live, so it can be neither confirmed nor released (AC4)", async () => {
    expect((await open(expired)).holdLive).toBe(false);
  });
});
