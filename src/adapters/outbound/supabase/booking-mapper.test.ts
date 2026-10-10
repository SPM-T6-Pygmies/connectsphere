import { describe, expect, it } from "vitest";

import {
  toChangeRoomLayoutArgs,
  toEventBookingSummary,
  toOccupiedSlot,
  toSubmitBookingArgs,
} from "./booking-mapper";
import { toCoordinatorEventDetails } from "./coordinator-event-mapper";
import type { BookingRequest } from "@/core/domain/booking";
import { userAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";

describe("booking mapper (SPM-46)", () => {
  it("reads a booked slot, keeping only the calendar date", () => {
    expect(toOccupiedSlot({ slot_date: "2026-10-05", slot: "Night", status: "Confirmed" })).toEqual({
      date: "2026-10-05",
      slot: "Night",
      status: "Confirmed",
    });
  });

  it("refuses a slot or status the schema does not allow", () => {
    expect(() => toOccupiedSlot({ slot_date: "2026-10-05", slot: "Evening", status: "Confirmed" })).toThrow();
    expect(() => toOccupiedSlot({ slot_date: "2026-10-05", slot: "AM", status: "Pending" })).toThrow();
  });

  it("reads an event's booking with its layout name and slots", () => {
    expect(
      toEventBookingSummary({
        booking_id: 12,
        venue_id: 3,
        venue_location: "Studio",
        room_layout_name: null,
        status: "Requested",
        created_at: "2026-09-28T02:00:00+00:00",
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).toEqual({
      id: "12",
      venueId: venueId("3"),
      venueLocation: "Studio",
      roomLayoutName: null,
      status: "Requested",
      slots: [{ date: "2026-10-05", slot: "AM" }],
      requestedAt: "2026-09-28T02:00:00+00:00",
    });
  });
});

describe("booking mapper -- submit arguments (SPM-104)", () => {
  const request: BookingRequest = {
    eventId: "7",
    venueId: venueId("3"),
    roomLayout: "Banquet",
    slots: [{ date: "2026-10-05", slot: "AM" }],
    requestedBy: userAccountId("2"),
    status: "Requested",
  };

  it("sends the chosen layout by name, for the database to resolve", () => {
    expect(toSubmitBookingArgs(request)).toEqual({
      p_coordinator_user_account_id: 2,
      p_event_id: 7,
      p_venue_id: 3,
      p_room_layout: "Banquet",
      p_slots: [{ date: "2026-10-05", slot: "AM" }],
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
        event_slots: [{ date: "2026-11-20", slot: "AM" }],
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
      }),
    ).toEqual({
      id: "5",
      eventRequestId: "24",
      name: "Roadmap Conference",
      status: "Planning",
      preferredDate: "2026-11-20",
      slots: [{ date: "2026-11-20", slot: "AM" }],
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
    });

    expect(details.slots).toEqual([]);
  });
});
