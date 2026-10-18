import { describe, expect, it } from "vitest";

import {
  clarificationRequestedRow,
  coordinatorAssignedRow,
  equipmentDecidedRow,
  equipmentNeedsAttentionRow,
  eventRequestDecidedRow,
  holdExpiredRow,
  organiserCoordinatorAssignedRow,
  organiserMessagePostedRow,
  safetyCheckReadyRow,
  safetyCheckRecordedRow,
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
        preferredSlots: [],
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
        slots: [{ date: "2026-11-20", slot: "PM" }],
      }),
    ).toEqual({
      recipient_user_account_id: "5",
      trigger_scenario: "venue-booking-requested",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom requested for Harbour Lights Gala\nRequested for Fri, 20 Nov 2026 (PM). Approve or reject it.",
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
        slots: [{ date: "2026-11-20", slot: "PM" }],
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
        "Grand Ballroom approved for Harbour Lights Gala\nVenue Staff confirmed Grand Ballroom for Fri, 20 Nov 2026 (PM). The venue is secured.",
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
        slots: [{ date: "2026-11-20", slot: "PM" }],
        holdExpiresAt: "2026-11-18T05:00:00.000Z",
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "hold-expired",
      channel: "in_app",
      status: "Pending",
      related_booking_id: "31",
      message_content:
        "Grand Ballroom hold expired for Harbour Lights Gala\nThe hold on Grand Ballroom for Fri, 20 Nov 2026 (PM) expired at Wed, 18 Nov, 1:00 pm without being confirmed. The venue is no longer held; send a new request if you still need it.",
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
