import { describe, expect, it } from "vitest";

import {
  toChangeRoomLayoutArgs,
  toEventBookingSummary,
  toOccupiedTime,
  toSubmitBookingArgs,
} from "./booking-mapper";
import { toCoordinatorEventDetails } from "./coordinator-event-mapper";
import type { BookingRequest } from "@/core/domain/booking";
import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";

describe("booking mapper (SPM-46)", () => {
  it("reads a booked slot as its hours, keeping only the calendar date and HH:MM", () => {
    expect(
      toOccupiedTime({
        slot_date: "2026-10-05",
        start_time: "23:45:00",
        end_time: "24:00:00",
        status: "Confirmed",
        hold_expires_at: null,
      }),
    ).toEqual({
      date: "2026-10-05",
      start: "23:45",
      end: "24:00",
      status: "Confirmed",
      holdExpiresAt: null,
    });
  });

  it("reads a hold's expiry as an instant (AC4)", () => {
    expect(
      toOccupiedTime({
        slot_date: "2026-10-05",
        start_time: "07:00:00",
        end_time: "07:15:00",
        status: "Tentative Hold",
        hold_expires_at: "2026-10-03T10:00:00+00:00",
      }).holdExpiresAt,
    ).toEqual(new Date("2026-10-03T10:00:00Z"));
  });

  it("refuses a status the schema does not allow", () => {
    expect(() =>
      toOccupiedTime({
        slot_date: "2026-10-05",
        start_time: "07:00:00",
        end_time: "07:15:00",
        status: "Pending",
        hold_expires_at: null,
      }),
    ).toThrow();
  });

  it("reads a held booking's expiry as the instant it lapses (SPM-218)", () => {
    expect(
      toEventBookingSummary({
        booking_id: 12,
        venue_id: 3,
        venue_location: "Studio",
        room_layout_name: "Theatre",
        status: "Tentative Hold",
        hold_expires_at: "2026-10-04T01:00:00+00:00",
        created_at: "2026-09-28T02:00:00+00:00",
        slots: [{ date: "2026-10-05", start: "07:00:00", end: "12:00:00" }],
        rejection_note: null,
        suggested_alternative_venue_id: null,
        suggested_alternative_location: null,
      }),
    ).toMatchObject({ status: "Tentative Hold", holdExpiresAt: "2026-10-04T01:00:00+00:00" });
  });

  it("reads an event's booking with its layout name and slots", () => {
    expect(
      toEventBookingSummary({
        booking_id: 12,
        venue_id: 3,
        venue_location: "Studio",
        room_layout_name: null,
        status: "Requested",
        hold_expires_at: null,
        created_at: "2026-09-28T02:00:00+00:00",
        slots: [{ date: "2026-10-05", start: "07:00:00", end: "12:00:00" }],
        rejection_note: null,
        suggested_alternative_venue_id: null,
        suggested_alternative_location: null,
      }),
    ).toEqual({
      id: "12",
      venueId: venueId("3"),
      venueLocation: "Studio",
      roomLayoutName: null,
      status: "Requested",
      holdExpiresAt: null,
      times: [{ date: "2026-10-05", start: "07:00", end: "12:00" }],
      requestedAt: "2026-09-28T02:00:00+00:00",
      rejectionNote: null,
      suggestedAlternative: null,
    });
  });
});

describe("booking mapper -- Venue Staff's answer (SPM-62)", () => {
  it("AC2: reads a rejected booking's reason and the venue suggested instead", () => {
    expect(
      toEventBookingSummary({
        booking_id: 12,
        venue_id: 3,
        venue_location: "Rooftop Terrace",
        room_layout_name: null,
        status: "Rejected",
        hold_expires_at: null,
        created_at: "2026-09-28T02:00:00+00:00",
        slots: [{ date: "2026-10-05", start: "07:00:00", end: "12:00:00" }],
        rejection_note: "Closed for resurfacing.",
        suggested_alternative_venue_id: 1,
        suggested_alternative_location: "Main Hall",
      }),
    ).toMatchObject({
      rejectionNote: "Closed for resurfacing.",
      suggestedAlternative: { venueId: venueId("1"), location: "Main Hall" },
    });
  });
});

describe("booking mapper -- submit arguments (SPM-104)", () => {
  const request: BookingRequest = {
    eventId: "7",
    venueId: venueId("3"),
    roomLayout: "Banquet",
    times: [{ date: "2026-10-05", start: "07:00", end: "07:45" }],
    requestedBy: userAccountId("2"),
    status: "Requested",
  };

  it("sends the chosen layout by name, for the database to resolve", () => {
    expect(toSubmitBookingArgs(request)).toEqual({
      p_coordinator_user_account_id: 2,
      p_event_id: 7,
      p_venue_id: 3,
      p_room_layout: "Banquet",
      p_slots: [
        { date: "2026-10-05", slot: "28" },
        { date: "2026-10-05", slot: "29" },
        { date: "2026-10-05", slot: "30" },
      ],
    });
  });

  it("sends no layout when the venue has none", () => {
    expect(toSubmitBookingArgs({ ...request, roomLayout: null })?.p_room_layout).toBeNull();
  });

  it("gives up on an id this store could not have issued", () => {
    expect(toSubmitBookingArgs({ ...request, venueId: venueId("hall") })).toBeNull();
  });
});

describe("booking mapper -- change layout arguments (SPM-104)", () => {
  it("sends the new layout by name, for the database to resolve", () => {
    expect(
      toChangeRoomLayoutArgs(userAccountId("2"), "12", "Boardroom"),
    ).toEqual({
      p_coordinator_user_account_id: 2,
      p_booking_id: 12,
      p_room_layout: "Boardroom",
    });
  });

  it("sends no layout when there is none to set", () => {
    expect(
      toChangeRoomLayoutArgs(userAccountId("2"), "12", null)?.p_room_layout,
    ).toBeNull();
  });

  it("gives up on an id this store could not have issued", () => {
    expect(
      toChangeRoomLayoutArgs(userAccountId("coordinator"), "12", "Boardroom"),
    ).toBeNull();
    expect(
      toChangeRoomLayoutArgs(userAccountId("2"), "booking", "Boardroom"),
    ).toBeNull();
  });
});

describe("coordinator event mapper -- booking details (SPM-46)", () => {
  it("carries the event's timing and venue requirements", () => {
    expect(
      toCoordinatorEventDetails({
        event_id: 5,
        event_request_id: 24,
        name: "Roadmap Conference",
        status: "Planning",
        preferred_date: "2026-11-20",
        assigned_coordinator_user_account_id: 2,
        client_organisation_id: 1,
        event_slots: [
          { date: "2026-11-20", start: "07:00:00", end: "07:15:00" },
          { date: "2026-11-20", start: "07:15:00", end: "07:30:00" },
        ],
        expected_attendance: 120,
        venue_requirements: "Stage",
        room_layout_preference: "Theatre",
        accessibility_requirements: "Step-free",
        required_facilities: "Wi-Fi, Catering area",
        description: null,
        purpose: null,
        category_type: null,
        programme_agenda: null,
        special_arrangements: null,
        operational_notes: null,
        registration_enabled_flag: false,
        registration_open_date: null,
        registration_close_date: null,
      }),
    ).toEqual({
      id: "5",
      eventRequestId: "24",
      name: "Roadmap Conference",
      status: "Planning",
      preferredDate: "2026-11-20",
      times: [{ date: "2026-11-20", start: "07:00", end: "07:30" }],
      expectedAttendance: 120,
      venueRequirements: "Stage",
      roomLayoutPreference: "Theatre",
      accessibilityRequirements: "Step-free",
      requiredFacilities: "Wi-Fi, Catering area",
      description: null,
      purpose: null,
      categoryType: null,
      programmeAgenda: null,
      specialArrangements: null,
      operationalNotes: null,
      registrationEnabled: false,
      registrationOpensOn: null,
      registrationClosesOn: null,
    });
  });

  it("reads an event with no recorded facilities as needing none", () => {
    const details = toCoordinatorEventDetails({
      event_id: 5,
      event_request_id: null,
      name: "Roadmap Conference",
      status: "Planning",
      preferred_date: null,
      assigned_coordinator_user_account_id: 2,
      client_organisation_id: 1,
      expected_attendance: null,
      venue_requirements: null,
      room_layout_preference: null,
      accessibility_requirements: null,
      required_facilities: null,
      description: null,
      purpose: null,
      category_type: null,
      programme_agenda: null,
      special_arrangements: null,
      operational_notes: null,
      registration_enabled_flag: false,
      registration_open_date: null,
      registration_close_date: null,
    });

    expect(details.requiredFacilities).toBeNull();
  });

  it("reads an event whose query did not select its slots as having none", () => {
    const details = toCoordinatorEventDetails({
      event_id: 5,
      event_request_id: null,
      name: "Roadmap Conference",
      status: "Planning",
      preferred_date: null,
      assigned_coordinator_user_account_id: 2,
      client_organisation_id: 1,
      expected_attendance: null,
      venue_requirements: null,
      room_layout_preference: null,
      accessibility_requirements: null,
      required_facilities: null,
      description: null,
      purpose: null,
      category_type: null,
      programme_agenda: null,
      special_arrangements: null,
      operational_notes: null,
      registration_enabled_flag: false,
      registration_open_date: null,
      registration_close_date: null,
    });

    expect(details.times).toEqual([]);
  });
});

describe("booking mapper -- requested times as 15-minute slots (SPM-347)", () => {
  it("sends one code per 15 minutes each time covers, on its own date", () => {
    const request: BookingRequest = {
      eventId: "7",
      venueId: venueId("3"),
      roomLayout: null,
      times: [
        { date: "2026-10-05", start: "07:00", end: "12:00" },
        { date: "2026-10-06", start: "23:45", end: "24:00" },
      ],
      requestedBy: userAccountId("2"),
      status: "Requested",
    };

    const slots = toSubmitBookingArgs(request)?.p_slots ?? [];

    expect(slots.filter(({ date }) => date === "2026-10-05").map(({ slot }) => slot)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(28 + i)),
    );
    expect(slots.filter(({ date }) => date === "2026-10-06")).toEqual([{ date: "2026-10-06", slot: "95" }]);
  });
});
