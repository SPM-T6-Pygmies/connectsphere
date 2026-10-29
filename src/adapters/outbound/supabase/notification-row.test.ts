import { describe, expect, it } from "vitest";

import {
  changeRequestedRow,
  clarificationRequestedRow,
  coordinatorAssignedRow,
  equipmentDecidedRow,
  equipmentNeedsAttentionRow,
  eventCancelledRow,
  eventRequestDecidedRow,
  eventRescheduledRow,
  holdExpiredRow,
  organiserCoordinatorAssignedRow,
  organiserMessagePostedRow,
  safetyCheckReadyRow,
  safetyCheckRecordedRow,
  venueBookingCancelledRow,
  venueBookingFlaggedRow,
  venueBookingDecidedRow,
  venueBookingRequestedRow,
} from "./notification-row";

describe("coordinatorAssignedRow (SPM-177)", () => {
  it("records an in-app coordinator assignment as Pending against its recipient and request", () => {
    expect(
      coordinatorAssignedRow({
        recipientUserAccountId: "7",
        eventRequestId: "42",
        eventName: "Founders' Day",
        clientOrganisationName: "Acme Holdings",
        preferredDate: "2026-11-04",
        preferredStartTime: null,
        preferredEndTime: null,
      }),
    ).toEqual({
      recipient_user_account_id: "7",
      trigger_scenario: "coordinator-assigned",
      channel: "in_app",
      status: "Pending",
      related_event_request_id: "42",
      message_content:
        "Founders' Day has been assigned to you\nFounders' Day for Acme Holdings is now yours to review. Requested for Wed, 4 Nov 2026.",
    });
  });
});

describe("organiserCoordinatorAssignedRow (SPM-58)", () => {
  it("records the organiser's notice as Pending against the organiser and the request", () => {
    expect(
      organiserCoordinatorAssignedRow({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        coordinatorName: "Arjun Nair",
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "organiser-coordinator-assigned",
      channel: "in_app",
      status: "Pending",
      related_event_request_id: "42",
      message_content:
        "Arjun Nair is coordinating Founders' Day\nArjun Nair is now your point of contact at ConnectSphere for Founders' Day.",
    });
  });
});

describe("clarificationRequestedRow (SPM-59)", () => {
  it("records the clarification notice as Pending against the organiser and the request", () => {
    expect(
      clarificationRequestedRow({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        message: "Which rooms?",
      }),
    ).toMatchObject({
      recipient_user_account_id: "3",
      trigger_scenario: "clarification-requested",
      status: "Pending",
      related_event_request_id: "42",
    });
  });
});

describe("eventRequestDecidedRow (SPM-60)", () => {
  it("records the decision notice as Pending against the organiser and the request", () => {
    expect(
      eventRequestDecidedRow({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        decision: "rejected",
        decisionRecord: "Clash.",
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "event-request-decided",
      channel: "in_app",
      status: "Pending",
      related_event_request_id: "42",
      message_content: "Founders' Day was rejected\nYour coordinator rejected Founders' Day. Reason: Clash.",
    });
  });
});

describe("safetyCheckReadyRow (SPM-262)", () => {
  it("records the notice as Pending against its Safety Officer and the event", () => {
    expect(
      safetyCheckReadyRow({
        recipientUserAccountId: "11",
        eventId: "7",
        eventName: "Harbour Lights Gala",
        preferredDate: "2026-11-20",
        venues: ["Grand Ballroom"],
        equipmentLines: 1,
      }),
    ).toEqual({
      recipient_user_account_id: "11",
      trigger_scenario: "safety-check-ready",
      channel: "in_app",
      status: "Pending",
      related_event_id: "7",
      message_content:
        "Harbour Lights Gala is ready for a safety check\nConfirmed at Grand Ballroom. All equipment reserved. Event date: Fri, 20 Nov 2026.",
    });
  });
});

describe("safetyCheckRecordedRow (SPM-263)", () => {
  it("AC1, AC6: records the notice as Pending against the coordinator and the event", () => {
    expect(
      safetyCheckRecordedRow({
        recipientUserAccountId: "2",
        eventId: "7",
        eventName: "Marina Bay Gala",
        outcome: "Rejected",
        comments: "Switch to Theatre.",
      }),
    ).toEqual({
      recipient_user_account_id: "2",
      trigger_scenario: "safety-check-recorded",
      channel: "in_app",
      status: "Pending",
      related_event_id: "7",
      message_content:
        "Marina Bay Gala failed its safety check\nThe Safety Officer rejected Marina Bay Gala. Changes needed: Switch to Theatre.",
    });
  });
});

describe("venueBookingRequestedRow (SPM-61)", () => {
  it("AC1: records the notice as Pending against its Venue Staff member and the booking", () => {
    expect(
      venueBookingRequestedRow({
        recipientUserAccountId: "5",
        bookingId: "31",
        eventName: "Harbour Lights Gala",
        venueLocation: "Grand Ballroom",
        times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
      }),
    ).toEqual({
      recipient_user_account_id: "5",
      trigger_scenario: "venue-booking-requested",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom requested for Harbour Lights Gala\nRequested for Fri, 20 Nov 2026 (13:00–18:00). Approve or reject it.",
    });
  });
});

describe("equipmentNeedsAttentionRow (SPM-64)", () => {
  it("AC1: records the notice as Pending against its Technical Support Staff member and the event", () => {
    expect(
      equipmentNeedsAttentionRow({
        recipientUserAccountId: "5",
        eventId: "12",
        eventName: "Tech Summit Keynote",
        preferredDate: "2026-11-15",
        equipmentType: "Projector",
        change: "added",
        quantityRequested: 4,
        quantityWas: null,
        attention: "new",
      }),
    ).toEqual({
      recipient_user_account_id: "5",
      trigger_scenario: "equipment-needs-attention",
      channel: "in_app",
      status: "Pending",
      related_event_id: "12",
      message_content: "Projector requested for Tech Summit Keynote\n4 requested. Event date: Sun, 15 Nov 2026.",
    });
  });
});

describe("equipmentDecidedRow (SPM-65)", () => {
  it("AC1: records the notice as Pending against the coordinator and the event", () => {
    expect(
      equipmentDecidedRow({
        recipientUserAccountId: "3",
        eventId: "12",
        eventName: "Design Sprint Demo",
        preferredDate: null,
        lines: [
          {
            equipmentType: "Projector",
            quantityRequested: 4,
            outcome: "reserved",
            quantityReserved: 4,
            decidedByName: "Test Support Staff",
            comment: null,
          },
        ],
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "equipment-decided",
      channel: "in_app",
      status: "Pending",
      related_event_id: "12",
      message_content:
        "Equipment reserved for Design Sprint Demo\nProjector: 4 reserved by Test Support Staff. No event date set yet.",
    });
  });
});

describe("venueBookingDecidedRow (SPM-62)", () => {
  it("AC1: records the notice as Pending against the coordinator and the booking", () => {
    expect(
      venueBookingDecidedRow({
        recipientUserAccountId: "3",
        bookingId: "31",
        eventId: "8",
        eventRequestId: "6",
        eventName: "Harbour Lights Gala",
        venueLocation: "Grand Ballroom",
        times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
        outcome: "Confirmed",
        reason: null,
        suggestedAlternativeLocation: null,
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "venue-booking-decided",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom approved for Harbour Lights Gala\nVenue Staff confirmed Grand Ballroom for Fri, 20 Nov 2026 (13:00–18:00). The venue is secured.",
    });
  });
});

describe("holdExpiredRow (SPM-254)", () => {
  it("records the notice as Pending against the coordinator and the booking", () => {
    expect(
      holdExpiredRow({
        recipientUserAccountId: "3",
        bookingId: "31",
        eventId: "8",
        eventRequestId: "6",
        eventName: "Harbour Lights Gala",
        venueLocation: "Grand Ballroom",
        times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
        holdExpiresAt: "2026-11-18T05:00:00.000Z",
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "hold-expired",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom hold expired for Harbour Lights Gala\nThe hold on Grand Ballroom for Fri, 20 Nov 2026 (13:00–18:00) expired at Wed, 18 Nov, 1:00 pm without being confirmed. The venue is no longer held; send a new request if you still need it.",
    });
  });
});

describe("organiserMessagePostedRow (SPM-164)", () => {
  it("records the organiser-message notice as Pending against the coordinator and the request", () => {
    expect(
      organiserMessagePostedRow({
        recipientUserAccountId: "5",
        eventRequestId: "42",
        eventName: "Founders' Day",
        message: "Captions only.",
      }),
    ).toMatchObject({
      recipient_user_account_id: "5",
      trigger_scenario: "organiser-message-posted",
      status: "Pending",
      related_event_request_id: "42",
    });
  });
});

describe("venueBookingCancelledRow (SPM-63)", () => {
  it("AC1: records the notice as Pending against the Venue Staff member and the booking", () => {
    expect(
      venueBookingCancelledRow({
        recipientUserAccountId: "5",
        bookingId: "31",
        venueId: "2",
        venueLocation: "Grand Ballroom",
        eventName: "Harbour Lights Gala",
        times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
      }),
    ).toEqual({
      recipient_user_account_id: "5",
      trigger_scenario: "venue-booking-cancelled",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom booking cancelled for Harbour Lights Gala\nThe coordinator cancelled the confirmed booking of Grand Ballroom for Fri, 20 Nov 2026 (13:00–18:00). It is now Released, and that time is free to book again.",
    });
  });
});

describe("venueBookingFlaggedRow (SPM-71)", () => {
  it("AC1, AC2: records the notice as Pending against the coordinator and the booking", () => {
    expect(
      venueBookingFlaggedRow({
        recipientUserAccountId: "3",
        bookingId: "31",
        eventId: "8",
        eventName: "Harbour Lights Gala",
        venueLocation: "Grand Ballroom",
        reasonCode: "venue-unavailable",
        reasons: ["Maintenance: 2026-11-16 13:00 to 18:00"],
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "venue-booking-flagged",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom booking flagged for Harbour Lights Gala\nYour booking of Grand Ballroom for Harbour Lights Gala is flagged for review. Venue unavailable: Maintenance: 2026-11-16 13:00 to 18:00. Nothing has been cancelled or rebooked; open the event's Venue tab to decide what to do.",
    });
  });
});

describe("eventRescheduledRow (SPM-68)", () => {
  it("AC1: records the notice as Pending against the Organiser and the event", () => {
    expect(
      eventRescheduledRow({
        recipientUserAccountId: "3",
        eventId: "7",
        eventRequestId: "12",
        eventName: "Harbour Lights Gala",
        times: [{ date: "2026-11-21", start: "09:00", end: "12:00" }],
        backToPlanning: false,
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "event-rescheduled",
      channel: "in_app",
      status: "Pending",
      related_event_id: "7",
      message_content:
        "Harbour Lights Gala is rescheduled\nHarbour Lights Gala has been rescheduled. New times: Sat, 21 Nov 2026 (09:00–12:00).",
    });
  });
});

describe("eventCancelledRow (SPM-68)", () => {
  it("AC1: records the notice as Pending against the Organiser and the event", () => {
    expect(
      eventCancelledRow({
        recipientUserAccountId: "3",
        eventId: "7",
        eventRequestId: "12",
        eventName: "Harbour Lights Gala",
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "event-cancelled",
      channel: "in_app",
      status: "Pending",
      related_event_id: "7",
      message_content:
        "Harbour Lights Gala is cancelled\nHarbour Lights Gala has been cancelled. Its venue bookings and equipment reservations have been released.",
    });
  });
});

describe("changeRequestedRow (SPM-67)", () => {
  it("AC1: records the notice as Pending against the coordinator, the event and the change request", () => {
    expect(
      changeRequestedRow({
        recipientUserAccountId: "4",
        eventId: "7",
        changeRequestId: "41",
        eventName: "Harbour Lights Gala",
        changes: [{ field: "expected_attendance", value: 320 }],
      }),
    ).toEqual({
      recipient_user_account_id: "4",
      trigger_scenario: "change-requested",
      channel: "in_app",
      status: "Pending",
      related_event_id: "7",
      related_change_request_id: "41",
      message_content:
        "Change requested for Harbour Lights Gala\nThe Organiser of Harbour Lights Gala asks to change: Expected attendance → 320. Open the change request to accept or decline each change.",
    });
  });
});
