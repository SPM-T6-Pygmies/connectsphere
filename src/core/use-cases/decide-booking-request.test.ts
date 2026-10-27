import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryBookingReviewRepository } from "@/adapters/outbound/in-memory/in-memory-booking-review-repository";
import { InMemorySafetyCheckWatch } from "@/adapters/outbound/in-memory/in-memory-safety-check-watch";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";

import { slotTime, type BookingId, type BookingStatus } from "../domain/booking";
import {
  BookingNotDecidableError,
  BookingNotFoundError,
  DecisionReasonRequiredError,
  HoldNotLiveError,
  HoldSlotStartedError,
  VenuePaddedClashError,
  VenueSlotBlockedError,
} from "../domain/errors";
import { eventId } from "../domain/event";
import type { SafetyCheckCandidate } from "../domain/safety-check";
import { venueId } from "../domain/venue";
import type { BookingForReview } from "../ports/outbound/booking-review-repository";
import { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";
import { DecideBookingRequestUseCase } from "./decide-booking-request";

const STAFF = "staff-1";
const COORDINATOR = "coord-1";

function booking(
  id: string,
  status: BookingStatus,
  slot: "AM" | "PM" = "AM",
  venue = "v1",
  coordinator: string | null = COORDINATOR,
): BookingForReview {
  return {
    id: id as BookingId,
    status,
    venueId: venueId(venue),
    venueLocation: `Venue ${venue}`,
    roomLayoutName: "Theatre",
    times: [slotTime({ date: "2026-10-22", slot })],
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
      coordinatorUserAccountId: coordinator,
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

const NOW = new Date("2026-10-01T09:00:00+08:00");

/** A Tentative Hold on b1's slot, raised for another event, that lapses at `holdExpiresAt`. */
function holdOnSlot(holdExpiresAt: Date | null): BookingForReview {
  const base = booking("hold-1", "Tentative Hold", "AM", "v1");
  return {
    ...base,
    holdExpiresAt: holdExpiresAt === null ? null : holdExpiresAt.toISOString(),
    event: { ...base.event, id: "e2", name: "Other event" },
  };
}

/** `holds` are other events' Tentative Holds, which lapse at the time each carries. */
function build(
  rows: BookingForReview[],
  safetyWatch = new InMemorySafetyCheckWatch(),
  holds: readonly BookingForReview[] = [],
) {
  const reviews = new InMemoryBookingReviewRepository([...rows, ...holds], [STAFF], { v2: "Venue v2" }, {}, () => NOW);
  const notifier = new RecordingNotifier();
  const safetyCheck = new SafetyCheckEntryAnnouncer({ watch: safetyWatch, notifier });
  return {
    reviews,
    safetyWatch,
    notifier,
    useCase: new DecideBookingRequestUseCase({
      reviews,
      safetyCheck,
      clock: new FixedClock(NOW),
      notifier,
    }),
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
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("refuses to approve a slot a hold keeps until after now", async () => {
    const live = new Date(NOW.getTime() + 1000);
    const { useCase, reviews } = build([booking("b1", "Requested")], undefined, [holdOnSlot(live)]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("approves a slot whose only other booking is a hold that expired before now", async () => {
    const expired = new Date(NOW.getTime() - 1000);
    const { useCase, reviews } = build([booking("b1", "Requested")], undefined, [holdOnSlot(expired)]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(reviews.all()[0]?.status).toBe("Confirmed");
  });

  it("approves a slot the same event already holds at another venue -- each request is decided on its own (AC4)", async () => {
    const { useCase, reviews } = build([
      booking("b1", "Requested", "AM", "v1"),
      booking("b2", "Confirmed", "AM", "v2"),
    ]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(reviews.all()[0]?.status).toBe("Confirmed");
  });

  it("approves the second of two requests for one slot only if the first was not approved", async () => {
    const { useCase } = build([booking("b1", "Requested"), booking("b2", "Requested")]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    await expect(
      useCase.execute({ bookingId: "b2", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
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

  function event(pending: BookingStatus): SafetyCheckCandidate {
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

describe("DecideBookingRequestUseCase placing a hold (SPM-218)", () => {
  it("holding puts the request on hold and says until when (AC1)", async () => {
    const { useCase, reviews } = build([booking("b1", "Requested")]);

    const result = await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" });

    expect(result).toEqual({
      bookingId: "b1",
      status: "Tentative Hold",
      venueLocation: "Venue v1",
      holdExpiresAt: "2026-10-04T01:00:00.000Z",
    });
    expect(reviews.all()[0]?.status).toBe("Tentative Hold");
  });

  it("caps the hold at its slot's start when that is sooner than 72 hours (SPM-253 AC7)", async () => {
    const tomorrowAm = { ...booking("b1", "Requested"), times: [{ date: "2026-10-02", start: "07:00", end: "12:00" }] };
    const { useCase } = build([tomorrowAm]);

    const result = await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" });

    expect(result.holdExpiresAt).toBe("2026-10-01T23:00:00.000Z");
  });

  it("refuses a hold on a slot that has already started, and leaves the request waiting (SPM-253 AC7)", async () => {
    const startedAm = { ...booking("b1", "Requested"), times: [{ date: "2026-10-01", start: "07:00", end: "12:00" }] };
    const { useCase, reviews, notifier } = build([startedAm]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" }),
    ).rejects.toBeInstanceOf(HoldSlotStartedError);
    expect(reviews.all()[0]?.status).toBe("Requested");
    expect(notifier.bookingsDecided).toEqual([]);
  });

  it("refuses a slot another booking holds, and leaves the request waiting (AC2)", async () => {
    const { useCase, reviews } = build([booking("b1", "Requested"), booking("b2", "Confirmed")]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("refuses a slot a live hold keeps, but not one whose hold expired before now (AC2)", async () => {
    const live = build([booking("b1", "Requested")], undefined, [holdOnSlot(new Date(NOW.getTime() + 1000))]);
    await expect(
      live.useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);

    const expired = build([booking("b1", "Requested")], undefined, [holdOnSlot(new Date(NOW.getTime() - 1000))]);
    await expired.useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" });
    expect(expired.reviews.all()[0]?.status).toBe("Tentative Hold");
  });

  it("refuses a request that is not waiting any more, whichever status it holds (AC1)", async () => {
    for (const status of ["Tentative Hold", "Confirmed", "Rejected", "Released", "Cancelled"] as const) {
      const { useCase } = build([booking("b1", status)]);
      await expect(
        useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" }),
      ).rejects.toBeInstanceOf(BookingNotDecidableError);
    }
  });

  it("answers a booking Venue Staff may not see, or someone who is not Venue Staff, as not found (AC4)", async () => {
    const { useCase, reviews } = build([booking("b1", "Requested")]);

    await expect(
      useCase.execute({ bookingId: "nope", userAccountId: STAFF, decision: "hold" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: "not-staff", decision: "hold" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("holding the last pending booking tells no Safety Officer, since a hold is not a confirmed booking", async () => {
    const candidate = (pending: BookingStatus): SafetyCheckCandidate => ({
      event: {
        id: eventId("e1"),
        name: "Summit",
        status: "Planning",
        preferredDate: "2026-10-22",
        expectedAttendance: 80,
      },
      bookings: [
        { status: "Confirmed", venueName: "Venue v2" },
        { status: pending, venueName: "Venue v1" },
      ],
      equipmentLines: [],
      checked: false,
    });
    const safetyWatch = new InMemorySafetyCheckWatch([candidate("Requested")], ["safety-1"], { b1: "e1" });
    const { useCase, reviews, notifier } = build([booking("b1", "Requested")], safetyWatch);
    const decide = reviews.decide.bind(reviews);
    reviews.decide = async (decided) => {
      await decide(decided);
      safetyWatch.set(candidate(decided.status));
    };

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" });

    expect(notifier.safetyChecksReady).toEqual([]);
  });

  it("holding tells the coordinator nothing: a hold is not yet an answer", async () => {
    const { useCase, notifier } = build([booking("b1", "Requested")]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" });

    expect(notifier.bookingsDecided).toEqual([]);
  });
});

describe("DecideBookingRequestUseCase telling the coordinator (SPM-62)", () => {
  it("AC1: approving tells the event's assigned coordinator once, naming the outcome and the venue", async () => {
    const { useCase, notifier } = build([booking("b1", "Requested")]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(notifier.bookingsDecided).toEqual([
      {
        recipientUserAccountId: COORDINATOR,
        bookingId: "b1",
        eventId: "e1",
        eventRequestId: "r1",
        eventName: "Summit",
        venueLocation: "Venue v1",
        times: [{ date: "2026-10-22", start: "07:00", end: "12:00" }],
        outcome: "Confirmed",
        reason: null,
        suggestedAlternativeLocation: null,
      },
    ]);
  });

  it("AC2: rejecting carries the reason as stored and the suggested venue by name", async () => {
    const { useCase, notifier } = build([booking("b1", "Requested")]);

    await useCase.execute({
      bookingId: "b1",
      userAccountId: STAFF,
      decision: "reject",
      reason: "  Closed for resurfacing.  ",
      suggestedAlternative: "v2",
    });

    expect(notifier.bookingsDecided).toHaveLength(1);
    expect(notifier.bookingsDecided[0]).toMatchObject({
      outcome: "Rejected",
      reason: "Closed for resurfacing.",
      suggestedAlternativeLocation: "Venue v2",
    });
  });

  it("AC2: rejecting with no suggestion carries the reason alone", async () => {
    const { useCase, notifier } = build([booking("b1", "Requested")]);

    await useCase.execute({
      bookingId: "b1",
      userAccountId: STAFF,
      decision: "reject",
      reason: "Closed that day",
      suggestedAlternative: null,
    });

    expect(notifier.bookingsDecided[0]).toMatchObject({
      outcome: "Rejected",
      reason: "Closed that day",
      suggestedAlternativeLocation: null,
    });
  });

  it("AC1: each of an event's bookings, decided in turn, is its own notice naming its own venue", async () => {
    const { useCase, notifier } = build([
      booking("b1", "Requested", "AM", "v1"),
      booking("b2", "Requested", "AM", "v2"),
    ]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });
    await useCase.execute({
      bookingId: "b2",
      userAccountId: STAFF,
      decision: "reject",
      reason: "Closed that day",
      suggestedAlternative: null,
    });

    expect(notifier.bookingsDecided.map((notice) => [notice.venueLocation, notice.outcome])).toEqual([
      ["Venue v1", "Confirmed"],
      ["Venue v2", "Rejected"],
    ]);
  });

  it("an event with no assigned coordinator is still decided, and nobody is told", async () => {
    const { useCase, notifier, reviews } = build([booking("b1", "Requested", "AM", "v1", null)]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(reviews.all()[0]?.status).toBe("Confirmed");
    expect(notifier.bookingsDecided).toEqual([]);
  });

  it("a refused decision tells the coordinator nothing", async () => {
    const { useCase, notifier } = build([
      booking("b1", "Requested"),
      booking("b2", "Confirmed"),
      booking("b3", "Rejected", "PM"),
    ]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "reject", reason: " ", suggestedAlternative: null }),
    ).rejects.toBeInstanceOf(DecisionReasonRequiredError);
    await expect(
      useCase.execute({ bookingId: "b3", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(BookingNotDecidableError);
    await expect(
      useCase.execute({ bookingId: "nope", userAccountId: STAFF, decision: "approve" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);

    expect(notifier.bookingsDecided).toEqual([]);
  });
});

describe("DecideBookingRequestUseCase confirming or releasing a hold (SPM-219)", () => {
  const LIVE_UNTIL = "2026-10-03T09:00:00.000Z";
  const EXPIRED_AT = "2026-10-01T00:59:59.000Z";

  function held(id = "b1", expiresAt: string | null = LIVE_UNTIL): BookingForReview {
    return { ...booking(id, "Tentative Hold"), holdExpiresAt: expiresAt };
  }

  it("confirming a live hold makes it Confirmed and tells the coordinator, as an approval does (AC1, AC5)", async () => {
    const { useCase, reviews, notifier } = build([held()]);

    const result = await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "confirm" });

    expect(result).toEqual({ bookingId: "b1", status: "Confirmed", venueLocation: "Venue v1" });
    expect(reviews.all()[0]?.status).toBe("Confirmed");
    expect(notifier.bookingsDecided).toEqual([
      {
        recipientUserAccountId: COORDINATOR,
        bookingId: "b1",
        eventId: "e1",
        eventRequestId: "r1",
        eventName: "Summit",
        venueLocation: "Venue v1",
        times: [{ date: "2026-10-22", start: "07:00", end: "12:00" }],
        outcome: "Confirmed",
        reason: null,
        suggestedAlternativeLocation: null,
      },
    ]);
  });

  it("releasing a live hold makes it Released and tells the coordinator which venue and slots (AC2, AC6)", async () => {
    const { useCase, reviews, notifier } = build([held()]);

    const result = await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "release" });

    expect(result).toEqual({ bookingId: "b1", status: "Released", venueLocation: "Venue v1" });
    expect(reviews.all()[0]?.status).toBe("Released");
    expect(notifier.bookingsDecided).toHaveLength(1);
    expect(notifier.bookingsDecided[0]).toMatchObject({
      recipientUserAccountId: COORDINATOR,
      outcome: "Released",
      venueLocation: "Venue v1",
      times: [{ date: "2026-10-22", start: "07:00", end: "12:00" }],
      reason: null,
    });
  });

  it("refuses a hold that has expired, even if its status has not moved on, and tells nobody (AC4)", async () => {
    for (const decision of ["confirm", "release"] as const) {
      const { useCase, reviews, notifier } = build([held("b1", EXPIRED_AT)]);

      await expect(
        useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision }),
      ).rejects.toBeInstanceOf(HoldNotLiveError);
      expect(reviews.all()[0]?.status).toBe("Tentative Hold");
      expect(notifier.bookingsDecided).toEqual([]);
    }
  });

  it("refuses a booking that is not a hold: waiting, confirmed, released or rejected (AC4)", async () => {
    for (const status of ["Requested", "Confirmed", "Released", "Rejected", "Cancelled"] as const) {
      const { useCase, reviews } = build([booking("b1", status)]);

      await expect(
        useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "confirm" }),
      ).rejects.toBeInstanceOf(HoldNotLiveError);
      expect(reviews.all()[0]?.status).toBe(status);
    }
  });

  it("a hold already confirmed cannot be released afterwards (AC4)", async () => {
    const { useCase, reviews } = build([held()]);
    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "confirm" });

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "release" }),
    ).rejects.toBeInstanceOf(HoldNotLiveError);
    expect(reviews.all()[0]?.status).toBe("Confirmed");
  });

  it("a confirmation the store refuses over a block recorded after the hold changes nothing and tells nobody (AC7)", async () => {
    const { useCase, reviews, notifier } = build([held()]);
    reviews.resolveHold = async () => {
      throw new VenueSlotBlockedError([{ date: "2026-10-22", start: "07:00", end: "12:00" }]);
    };

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "confirm" }),
    ).rejects.toBeInstanceOf(VenueSlotBlockedError);
    expect(reviews.all()[0]?.status).toBe("Tentative Hold");
    expect(notifier.bookingsDecided).toEqual([]);
  });

  it("answers someone who is not Venue Staff, or a booking that does not exist, as not found", async () => {
    const { useCase, reviews } = build([held()]);

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: "someone-else", decision: "confirm" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    await expect(
      useCase.execute({ bookingId: "nope", userAccountId: STAFF, decision: "release" }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    expect(reviews.all()[0]?.status).toBe("Tentative Hold");
  });

  it("an event with no assigned coordinator is resolved and nobody is told", async () => {
    const { useCase, reviews, notifier } = build([{ ...held(), event: { ...held().event, coordinatorUserAccountId: null } }]);

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "release" });

    expect(reviews.all()[0]?.status).toBe("Released");
    expect(notifier.bookingsDecided).toEqual([]);
  });

  it("confirming the last pending hold tells the Safety Officer, as an approval does", async () => {
    const candidate = (pending: BookingStatus): SafetyCheckCandidate => ({
      event: {
        id: eventId("e1"),
        name: "Summit",
        status: "Planning",
        preferredDate: "2026-10-22",
        expectedAttendance: 80,
      },
      bookings: [
        { status: "Confirmed", venueName: "Venue v2" },
        { status: pending, venueName: "Venue v1" },
      ],
      equipmentLines: [],
      checked: false,
    });
    const safetyWatch = new InMemorySafetyCheckWatch([candidate("Tentative Hold")], ["safety-1"], { b1: "e1" });
    const { useCase, reviews, notifier } = build([held()], safetyWatch);
    const resolve = reviews.resolveHold.bind(reviews);
    reviews.resolveHold = async (resolved) => {
      await resolve(resolved);
      safetyWatch.set(candidate(resolved.status));
    };

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "confirm" });

    expect(notifier.safetyChecksReady.map((notice) => notice.recipientUserAccountId)).toEqual(["safety-1"]);
  });
});

describe("DecideBookingRequestUseCase, setup and turnaround (SPM-19)", () => {
  const MAIN_HALL = { setup: 30, turnaround: 45 };
  const DAY = "2026-12-14";

  /** A request at Main Hall v1 (30 / 45) and the booking already there, at the given times. */
  function atMainHall(
    existing: { status: BookingStatus; start: string; end: string },
    request: { start: string; end: string },
  ) {
    const asked = booking("b1", "Requested", "AM", "v1");
    const there = booking("b2", existing.status, "AM", "v1");
    const rows = [
      { ...asked, times: [{ date: DAY, ...request }] },
      {
        ...there,
        times: [{ date: DAY, start: existing.start, end: existing.end }],
        event: { ...there.event, name: "Charity Run" },
      },
    ];
    const reviews = new InMemoryBookingReviewRepository(rows, [STAFF], {}, { v1: MAIN_HALL }, () => NOW);
    const notifier = new RecordingNotifier();
    const useCase = new DecideBookingRequestUseCase({
      reviews,
      safetyCheck: new SafetyCheckEntryAnnouncer({ watch: new InMemorySafetyCheckWatch(), notifier }),
      clock: new FixedClock(NOW),
      notifier,
    });
    return { useCase, reviews };
  }

  it("AC1: refuses to approve a request whose setup runs into another booking's turnaround, though the times do not touch", async () => {
    const { useCase, reviews } = atMainHall(
      { status: "Confirmed", start: "07:00", end: "09:15" },
      { start: "10:00", end: "12:00" },
    );

    const error = await useCase
      .execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenuePaddedClashError);
    expect((error as VenuePaddedClashError).clashes).toEqual([
      { eventName: "Charity Run", date: DAY, start: "09:30", end: "10:00", hold: null },
    ]);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("AC2: approves a request whose setup starts exactly when the other booking's turnaround ends", async () => {
    const { useCase, reviews } = atMainHall(
      { status: "Confirmed", start: "07:00", end: "09:15" },
      { start: "10:30", end: "12:00" },
    );

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(reviews.all()[0]?.status).toBe("Confirmed");
  });

  it("AC3: refuses to place a hold in the same way, and the request stays Requested", async () => {
    const { useCase, reviews } = atMainHall(
      { status: "Confirmed", start: "07:00", end: "09:15" },
      { start: "10:00", end: "12:00" },
    );

    await expect(
      useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "hold" }),
    ).rejects.toBeInstanceOf(VenuePaddedClashError);
    expect(reviews.all()[0]?.status).toBe("Requested");
  });

  it("AC4: a Tentative Hold in the way is padded like a Confirmed booking, and the refusal says it is held", async () => {
    const { useCase } = atMainHall(
      { status: "Tentative Hold", start: "07:00", end: "09:15" },
      { start: "10:00", end: "12:00" },
    );

    const error = await useCase
      .execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenuePaddedClashError);
    expect((error as VenuePaddedClashError).message).toContain("• Charity Run on 2026-12-14 (09:30–10:00, incl. setup & turnaround): already temporarily reserved (held)");
  });

  it("AC5: a Rejected booking in the way does not block", async () => {
    const { useCase, reviews } = atMainHall(
      { status: "Rejected", start: "07:00", end: "09:15" },
      { start: "10:00", end: "12:00" },
    );

    await useCase.execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" });

    expect(reviews.all()[0]?.status).toBe("Confirmed");
  });
});

describe("DecideBookingRequestUseCase, an approval refused over a live booking (SPM-353)", () => {
  it("names the clashing date and times, leaves the request Requested and tells nobody", async () => {
    const { useCase, reviews, notifier } = build([booking("b1", "Requested"), booking("b2", "Confirmed")]);

    const error = await useCase
      .execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VenuePaddedClashError);
    expect((error as VenuePaddedClashError).clashes).toEqual([
      { eventName: "Summit", date: "2026-10-22", start: "07:00", end: "12:00", hold: null },
    ]);
    expect(reviews.all()[0]?.status).toBe("Requested");
    expect(notifier.bookingsDecided).toEqual([]);
  });

  it("can still be rejected afterwards, and the coordinator is told", async () => {
    const { useCase, reviews, notifier } = build([booking("b1", "Requested"), booking("b2", "Confirmed")]);
    await useCase
      .execute({ bookingId: "b1", userAccountId: STAFF, decision: "approve" })
      .catch(() => undefined);

    await useCase.execute({
      bookingId: "b1",
      userAccountId: STAFF,
      decision: "reject",
      reason: "Already booked then.",
      suggestedAlternative: null,
    });

    expect(reviews.all()[0]).toMatchObject({ status: "Rejected", rejectionNote: "Already booked then." });
    expect(notifier.bookingsDecided.map(({ outcome }) => outcome)).toEqual(["Rejected"]);
  });
});
