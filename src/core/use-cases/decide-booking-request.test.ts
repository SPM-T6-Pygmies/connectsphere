import { describe, expect, it } from "vitest";

import { InMemoryBookingRepository } from "@/adapters/outbound/in-memory/in-memory-booking-repository";
import { InMemoryBookingReviewRepository } from "@/adapters/outbound/in-memory/in-memory-booking-review-repository";
import { InMemorySafetyCheckWatch } from "@/adapters/outbound/in-memory/in-memory-safety-check-watch";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";

import type { BookingId, BookingStatus } from "../domain/booking";
import {
  BookingNotDecidableError,
  BookingNotFoundError,
  DecisionReasonRequiredError,
  VenueSlotUnavailableError,
} from "../domain/errors";
import { eventId } from "../domain/event";
import type { SafetyCheckCandidate } from "../domain/safety-check";
import { venueId } from "../domain/venue";
import type { BookingForReview } from "../ports/outbound/booking-review-repository";
import { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";
import { DecideBookingRequestUseCase } from "./decide-booking-request";

const STAFF = "staff-1";

function booking(
  id: string,
  status: BookingStatus,
  slot: "AM" | "PM" = "AM",
  venue = "v1",
): BookingForReview {
  return {
    id: id as BookingId,
    status,
    venueId: venueId(venue),
    venueLocation: `Venue ${venue}`,
    roomLayoutName: "Theatre",
    slots: [{ date: "2026-10-22", slot }],
    requestedByName: "Coordinator",
    requestedAt: "2026-10-01T00:00:00.000Z",
    decidedByName: null,
    rejectionNote: null,
    suggestedAlternativeLocation: null,
    event: {
      name: "Summit",
      status: "Planning",
      organisationName: null,
      category: null,
      preferredDate: null,
      slots: [],
      expectedAttendance: null,
      roomLayoutPreference: null,
      accessibilityRequirements: null,
      venueRequirements: null,
      equipmentRequirements: null,
      specialArrangements: null,
    },
  };
}

function build(rows: BookingForReview[], safetyWatch = new InMemorySafetyCheckWatch()) {
  const reviews = new InMemoryBookingReviewRepository(rows, [STAFF]);
  const bookings = new InMemoryBookingRepository(
    rows.map((row) => ({
      id: row.id,
      eventId: "e1",
      venueId: row.venueId,
      venueLocation: row.venueLocation,
      roomLayoutName: row.roomLayoutName,
      status: row.status,
      slots: row.slots,
      requestedBy: "c1",
      requestedAt: row.requestedAt,
    })),
  );
  const notifier = new RecordingNotifier();
  const safetyCheck = new SafetyCheckEntryAnnouncer({ watch: safetyWatch, notifier });
  return {
    reviews,
    safetyWatch,
    notifier,
    useCase: new DecideBookingRequestUseCase({ reviews, bookings, safetyCheck }),
  };
}

describe("DecideBookingRequestUseCase (SPM-22)", () => {
  it("approving confirms the booking and says where", async () => {
    const { useCase, reviews } = build([booking("b1", "Requested")]);

    const result = await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(result).toEqual({ bookingId: "b1", status: "Confirmed", venueLocation: "Venue v1" });
    expect(reviews.all()[0]?.status).toBe("Confirmed");
  });

  it("rejecting keeps the reason", async () => {
    const { useCase, reviews } = build([booking("b1", "Requested")]);

    await useCase.execute({
      bookingId: "b1",
      userAccountId: STAFF,
      decision: "reject",
      reason: "Closed that day",
      suggestedAlternative: null,
    });

    expect(reviews.all()[0]).toMatchObject({ status: "Rejected", rejectionNote: "Closed that day" });
  });

  it("refuses a rejection with no reason and leaves the booking waiting", async () => {
    const { useCase, reviews } = build([booking("b1", "Requested")]);

    await expect(
      useCase.execute({
        bookingId: "b1",
        userAccountId: STAFF,
        decision: "reject",
        reason: " ",
        suggestedAlternative: null,
      }),
    ).rejects.toBeInstanceOf(DecisionReasonRequiredError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("refuses to approve a slot another booking already holds", async () => {
    const { useCase, reviews } = build([
      booking("b1", "Requested"),
      booking("b2", "Confirmed"),
    ]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(VenueSlotUnavailableError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("approves the second of two requests for one slot only if the first was not approved", async () => {
    const { useCase } = build([booking("b1", "Requested"), booking("b2", "Requested")]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    await expect(
      useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(VenueSlotUnavailableError);
  });

  it("refuses a booking that has already been decided", async () => {
    const { useCase } = build([booking("b1", "Rejected")]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(BookingNotDecidableError);
  });

  it("treats a booking the caller may not see like one that does not exist", async () => {
    const { useCase } = build([booking("b1", "Requested")]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: "someone-else", decision: "approve" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    await expect(
      useCase.execute({ bookingId: "nope", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
  });
});

describe("DecideBookingRequestUseCase telling Safety Officers (SPM-262)", () => {
  const EVENT = eventId("e1");

  function event(pending: "Requested" | "Confirmed" | "Rejected"): SafetyCheckCandidate {
    return {
      event: { id: EVENT, name: "Summit", status: "Planning", preferredDate: "2026-10-22", expectedAttendance: 80 },
      bookings: [
        { status: "Confirmed", venueName: "Venue v2" },
        { status: pending, venueName: "Venue v1" },
      ],
      equipmentLines: [],
      checked: false,
    };
  }

  /** b1 is pending beside a Confirmed booking; the watch sees it as the decision leaves it. */
  function decided(watched = event("Requested")) {
    const safetyWatch = new InMemorySafetyCheckWatch([watched], ["safety-1", "safety-2"], { b1: "e1" });
    const built = build([booking("b1", "Requested")], safetyWatch);
    const decide = built.reviews.decide.bind(built.reviews);
    built.reviews.decide = async (d) => {
      await decide(d);
      safetyWatch.set(event(d.status));
    };
    return built;
  }

  it("AC1, AC4: approving the last pending booking tells every Safety Officer", async () => {
    const { useCase, notifier } = decided();

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(notifier.safetyChecksReady.map((notice) => [notice.recipientUserAccountId, notice.eventName])).toEqual([
      ["safety-1", "Summit"],
      ["safety-2", "Summit"],
    ]);
  });

  it("AC1: rejecting the last pending booking, beside a Confirmed one, tells every Safety Officer", async () => {
    const { useCase, notifier } = decided();

    await useCase.execute({
      bookingId: "b1",
      userAccountId: STAFF,
      decision: "reject",
      reason: "Closed for repairs.",
      suggestedAlternative: null,
    });

    expect(notifier.safetyChecksReady).toHaveLength(2);
  });

  it("AC3: a refused decision tells no one", async () => {
    const { useCase, notifier } = decided();

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "reject", reason: " ", suggestedAlternative: null }),
    ).rejects.toThrow(DecisionReasonRequiredError);
    expect(notifier.safetyChecksReady).toEqual([]);
  });
});
