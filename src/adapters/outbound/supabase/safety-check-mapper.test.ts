import { describe, expect, it } from "vitest";

import {
  EventNotAwaitingSafetyCheckError,
  EventNotFoundError,
  NotSafetyOfficerError,
  SafetyCheckCommentsRequiredError,
  SafetyCheckNotResubmittableError,
} from "@/core/domain/errors";

import {
  toCoordinatorSafetyCheckHistory,
  toSafetyCheckError,
  toSafetyCheckReview,
  type SafetyCheckReviewRow,
} from "./safety-check-mapper";

const gala: SafetyCheckReviewRow = {
  event_id: 7,
  event_name: "Founders' Gala Dinner",
  status: "Planning",
  preferred_date: "2026-12-12",
  expected_attendance: 220,
  bookings: [{ status: "Confirmed", venue_location: "Grand Ballroom" }],
  equipment_lines: [{ line_state: "Reserved", quantity_requested: 2, quantity_reserved: 2 }],
  checked: true,
  accessibility_requirements: "Step-free route to the stage",
  coordinator_user_account_id: 2,
  venues: [
    {
      venue_location: "Grand Ballroom",
      room_layout_name: "Banquet",
      layout_capacity: 180,
      accessibility: "Lift to level 2",
    },
  ],
  equipment: [{ item: "Wireless microphone", quantity_requested: 2, quantity_reserved: 2 }],
  checks: [
    {
      outcome: "Rejected",
      comments: "Banquet layout holds 180; 220 expected.",
      checked_by_name: "Test Safety Officer",
      checked_at: "2026-10-06T17:30:00+08:00",
      resubmitted_at: null,
    },
  ],
};

describe("safety check mapper (SPM-260)", () => {
  it("AC1, AC5: maps the event, its confirmed venues, its equipment and its checks", () => {
    expect(toSafetyCheckReview(gala)).toEqual({
      candidate: {
        event: {
          id: "7",
          name: "Founders' Gala Dinner",
          status: "Planning",
          preferredDate: "2026-12-12",
          expectedAttendance: 220,
        },
        bookings: [{ status: "Confirmed", venueName: "Grand Ballroom" }],
        equipmentLines: [{ state: "Reserved", quantityRequested: 2, quantityReserved: 2 }],
        checked: true,
      },
      accessibilityRequirements: "Step-free route to the stage",
      coordinatorUserAccountId: "2",
      venues: [
        { venueName: "Grand Ballroom", layoutName: "Banquet", layoutCapacity: 180, accessibility: "Lift to level 2" },
      ],
      equipment: [{ item: "Wireless microphone", quantityRequested: 2, quantityReserved: 2 }],
      checks: [
        {
          outcome: "Rejected",
          comments: "Banquet layout holds 180; 220 expected.",
          checkedByName: "Test Safety Officer",
          checkedAt: "2026-10-06T09:30:00.000Z",
          resubmittedAt: null,
        },
      ],
    });
  });

  it("AC1: keeps a booking with no layout or capacity as unknown", () => {
    const mapped = toSafetyCheckReview({
      ...gala,
      venues: [{ venue_location: "Old Hall", room_layout_name: null, layout_capacity: null, accessibility: null }],
    });

    expect(mapped.venues).toEqual([
      { venueName: "Old Hall", layoutName: null, layoutCapacity: null, accessibility: null },
    ]);
  });

  it("SPM-263 AC6: maps an event with no assigned coordinator to null", () => {
    expect(toSafetyCheckReview({ ...gala, coordinator_user_account_id: null }).coordinatorUserAccountId).toBeNull();
  });

  it.each([
    { code: "CS050", error: NotSafetyOfficerError },
    { code: "CS051", error: EventNotAwaitingSafetyCheckError },
    { code: "CS052", error: SafetyCheckCommentsRequiredError },
  ])("AC3, AC6, AC7: maps SQLSTATE $code to its domain error", ({ code, error }) => {
    expect(toSafetyCheckError({ code })).toBeInstanceOf(error);
  });

  it("leaves any other failure to the caller", () => {
    expect(toSafetyCheckError({ code: "CS040" })).toBeNull();
    expect(toSafetyCheckError({})).toBeNull();
  });
});

describe("coordinator safety check history mapper (SPM-261)", () => {
  it("AC2: maps the event's status and its checks, with when a rejection was resubmitted", () => {
    expect(
      toCoordinatorSafetyCheckHistory({
        event_status: "Planning",
        checks: [
          {
            outcome: "Rejected",
            comments: "Switch to Theatre.",
            checked_by_name: "Test Safety Officer",
            checked_at: "2026-10-06T17:30:00+08:00",
            resubmitted_at: "2026-10-06T18:00:00+08:00",
          },
        ],
      }),
    ).toEqual({
      eventStatus: "Planning",
      checks: [
        {
          outcome: "Rejected",
          comments: "Switch to Theatre.",
          checkedByName: "Test Safety Officer",
          checkedAt: "2026-10-06T09:30:00.000Z",
          resubmittedAt: "2026-10-06T10:00:00.000Z",
        },
      ],
    });
  });

  it.each([
    { code: "CS053", error: EventNotFoundError },
    { code: "CS054", error: SafetyCheckNotResubmittableError },
  ])("AC3, AC5: maps SQLSTATE $code to its domain error", ({ code, error }) => {
    expect(toSafetyCheckError({ code }, "7")).toBeInstanceOf(error);
  });
});
