import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryBookingReviewRepository } from "@/adapters/outbound/in-memory/in-memory-booking-review-repository";
import { InMemorySafetyCheckWatch } from "@/adapters/outbound/in-memory/in-memory-safety-check-watch";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";

import type { BookingId, BookingStatus } from "../domain/booking";
import { ReRequestNotHoldableError, VenuePaddedClashError } from "../domain/errors";
import { venueId } from "../domain/venue";
import type { BookingForReview } from "../ports/outbound/booking-review-repository";
import { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";
import { DecideBookingRequestUseCase } from "./decide-booking-request";

const STAFF = "staff-1";
const NOW = new Date("2026-10-26T09:00:00+08:00");

function booking(id: string, status: BookingStatus, overrides: Partial<BookingForReview> = {}): BookingForReview {
  return {
    id: id as BookingId,
    status,
    venueId: venueId("v1"),
    venueLocation: "Main Hall",
    roomLayoutName: "Theatre",
    times: [{ date: "2026-11-16", start: "13:00", end: "18:00" }],
    requestedByName: "Coordinator",
    requestedAt: "2026-10-01T00:00:00.000Z",
    decidedByName: null,
    holdExpiresAt: null,
    rejectionNote: null,
    suggestedAlternativeLocation: null,
    replaces: null,
    event: {
      id: "e1",
      requestId: "r1",
      coordinatorUserAccountId: "coord-1",
      name: "Tech Summit",
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
    ...overrides,
  };
}

/** The flagged original: Confirmed at Main Hall, 13:00 to 18:00. */
const ORIGINAL = booking("b1", "Confirmed");

/** A re-request for b1 at the same venue, an hour later, so it overlaps the original. */
function reRequest(overrides: Partial<BookingForReview> = {}): BookingForReview {
  return booking("b2", "Requested", {
    times: [{ date: "2026-11-16", start: "14:00", end: "19:00" }],
    replaces: { id: ORIGINAL.id, venueLocation: "Main Hall", times: ORIGINAL.times, status: "Confirmed" },
    ...overrides,
  });
}

function build(rows: BookingForReview[]) {
  // Main Hall takes 30 minutes to set up and 30 to turn around (SPM-23).
  const reviews = new InMemoryBookingReviewRepository(rows, [STAFF], {}, { v1: { setup: 30, turnaround: 30 } }, () => NOW);
  const notifier = new RecordingNotifier();
  return {
    reviews,
    useCase: new DecideBookingRequestUseCase({
      reviews,
      safetyCheck: new SafetyCheckEntryAnnouncer({ watch: new InMemorySafetyCheckWatch(), notifier }),
      clock: new FixedClock(NOW),
      notifier,
    }),
  };
}

const statusOf = (reviews: InMemoryBookingReviewRepository, id: string) => reviews.all().find((row) => row.id === id)?.status;

describe("DecideBookingRequestUseCase on a re-request (SPM-251)", () => {
  it("AC5, AC6: approving it confirms it and releases the booking it replaces, though they overlap", async () => {
    const { useCase, reviews } = build([ORIGINAL, reRequest()]);

    const result = await useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "approve" });

    expect(result.status).toBe("Confirmed");
    expect(statusOf(reviews, "b1")).toBe("Released");
  });

  it("AC5: another booking within its setup or turnaround time still refuses the approval", async () => {
    const other = booking("b9", "Confirmed", {
      times: [{ date: "2026-11-16", start: "19:15", end: "21:00" }],
      event: { ...ORIGINAL.event, id: "e2", name: "Charity Run" },
    });
    const { useCase, reviews } = build([ORIGINAL, reRequest(), other]);

    await expect(useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "approve" })).rejects.toBeInstanceOf(
      VenuePaddedClashError,
    );
    expect(statusOf(reviews, "b1")).toBe("Confirmed");
  });

  it("AC7: rejecting it leaves the booking it replaces as it was", async () => {
    const { useCase, reviews } = build([ORIGINAL, reRequest()]);

    await useCase.execute({
      bookingId: "b2",
      userAccountId: STAFF,
      decision: "reject",
      reason: "Main Hall is closed that week",
      suggestedAlternative: null,
    });

    expect(statusOf(reviews, "b2")).toBe("Rejected");
    expect(statusOf(reviews, "b1")).toBe("Confirmed");
  });

  it("AC10: placing a hold on it is refused, and nothing changes", async () => {
    const { useCase, reviews } = build([ORIGINAL, reRequest()]);

    await expect(useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "hold" })).rejects.toBeInstanceOf(
      ReRequestNotHoldableError,
    );
    expect(statusOf(reviews, "b2")).toBe("Requested");
    expect(statusOf(reviews, "b1")).toBe("Confirmed");
  });

  it("AC6: an original that no longer holds its venue is left as it is", async () => {
    const { useCase, reviews } = build([booking("b1", "Cancelled"), reRequest()]);

    await useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "approve" });

    expect(statusOf(reviews, "b2")).toBe("Confirmed");
    expect(statusOf(reviews, "b1")).toBe("Cancelled");
  });

  it("AC8: approving it leaves the event's other bookings alone", async () => {
    const other = booking("b3", "Confirmed", { venueId: venueId("v2"), venueLocation: "Studio" });
    const { useCase, reviews } = build([ORIGINAL, reRequest(), other]);

    await useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "approve" });

    expect(statusOf(reviews, "b3")).toBe("Confirmed");
  });
});
