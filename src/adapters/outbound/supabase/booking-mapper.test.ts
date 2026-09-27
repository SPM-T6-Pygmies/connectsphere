import { describe, expect, it } from "vitest";

import {
  toBookableVenueSummary,
  toEventBookingSummary,
  toOccupiedSlot,
  toSubmitBookingArgs,
} from "./booking-mapper";
import { toCoordinatorEventDetails } from "./coordinator-event-mapper";
import { roomLayoutId, venueId, type BookingRequest } from "@/core/domain/booking";
import { userAccountId } from "@/core/domain/user-account";

describe("booking mapper (SPM-46)", () => {
  it("reads a venue with its supported layouts, ids as opaque strings", () => {
    expect(
      toBookableVenueSummary({
        venue_id: 3,
        location: "Main Hall",
        capacity: 300,
        facilities: "Stage",
        accessibility: null,
        layouts: [{ room_layout_id: 9, name: "Banquet", capacity: 180 }],
      }),
    ).toEqual({
      id: "3",
      location: "Main Hall",
      capacity: 300,
      facilities: "Stage",
      accessibility: null,
      supportedLayouts: [{ id: "9", name: "Banquet", capacity: 180 }],
    });
  });

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
        venue_location: "Studio",
        room_layout_name: null,
        status: "Requested",
        created_at: "2026-09-28T02:00:00+00:00",
        slots: [{ date: "2026-10-05", slot: "AM" }],
      }),
    ).toEqual({
      id: "12",
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
    roomLayoutId: roomLayoutId("9"),
    slots: [{ date: "2026-10-05", slot: "AM" }],
    requestedBy: userAccountId("2"),
    status: "Requested",
  };

  it("sends the chosen layout as a key, not as text", () => {
    expect(toSubmitBookingArgs(request)).toEqual({
      p_coordinator_user_account_id: 2,
      p_event_id: 7,
      p_venue_id: 3,
      p_room_layout_id: 9,
      p_slots: [{ date: "2026-10-05", slot: "AM" }],
    });
  });

  it("sends no layout when the venue has none", () => {
    expect(toSubmitBookingArgs({ ...request, roomLayoutId: null })?.p_room_layout_id).toBeNull();
  });

  it("gives up on an id this store could not have issued", () => {
    expect(toSubmitBookingArgs({ ...request, venueId: venueId("hall") })).toBeNull();
    expect(toSubmitBookingArgs({ ...request, roomLayoutId: roomLayoutId("theatre") })).toBeNull();
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
        start_time: "2026-11-20T01:00:00+00:00",
        end_time: "2026-11-20T04:00:00+00:00",
        expected_attendance: 120,
        venue_requirements: "Stage",
        room_layout_preference: "Theatre",
        accessibility_requirements: "Step-free",
      }),
    ).toEqual({
      id: "5",
      eventRequestId: "24",
      name: "Roadmap Conference",
      status: "Planning",
      preferredDate: "2026-11-20",
      startTime: "2026-11-20T01:00:00+00:00",
      endTime: "2026-11-20T04:00:00+00:00",
      expectedAttendance: 120,
      venueRequirements: "Stage",
      roomLayoutPreference: "Theatre",
      accessibilityRequirements: "Step-free",
    });
  });
});
