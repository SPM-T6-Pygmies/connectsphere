import { describe, expect, it } from "vitest";

import { toDomain, type EventRequestRow } from "./event-request-mapper";

describe("event request mapper", () => {
  it("maps every persisted operations field into the domain request", () => {
    const row: EventRequestRow = {
      event_request_id: 42,
      event_name: "Annual Client Forum",
      description: "Client briefing",
      purpose: "Share the annual plan",
      preferred_date: "2026-12-10",
      preferred_start_time: "2026-12-10T01:00:00.000Z",
      preferred_end_time: "2026-12-10T09:00:00.000Z",
      expected_attendance: 240,
      venue_requirements: "Main hall",
      room_layout_preferences: "Theatre",
      accessibility_needs: "Step-free access",
      equipment_requirements: "Four microphones",
      registration_requirements: "Invite only",
      general_programme: "Keynote and workshops",
      other_special_arrangements: "Security desk",
      status: "Under Review",
      decision_record: "Coordinator reviewing",
      requesting_user_account_id: 7,
      assigned_coordinator_user_account_id: 9,
      client_organisation_id: 3,
      created_at: "2026-09-01T01:00:00.000Z",
      updated_at: "2026-09-02T02:00:00.000Z",
    };

    expect(toDomain(row)).toMatchObject({
      id: "42",
      status: "Under Review",
      decisionRecord: "Coordinator reviewing",
      responsibleOrganiserId: "7",
      assignedCoordinatorUserAccountId: "9",
      clientOrganisationId: "3",
      createdAt: new Date("2026-09-01T01:00:00.000Z"),
      updatedAt: new Date("2026-09-02T02:00:00.000Z"),
      details: {
        eventName: "Annual Client Forum",
        description: "Client briefing",
        purpose: "Share the annual plan",
        preferredDate: "2026-12-10",
        preferredStartTime: "2026-12-10T01:00:00.000Z",
        preferredEndTime: "2026-12-10T09:00:00.000Z",
        expectedAttendance: 240,
        venueRequirements: "Main hall",
        roomLayoutPreferences: "Theatre",
        accessibilityNeeds: "Step-free access",
        equipmentRequirements: "Four microphones",
        registrationRequirements: "Invite only",
        generalProgramme: "Keynote and workshops",
        otherSpecialArrangements: "Security desk",
      },
    });
  });

  it("preserves an unassigned coordinator as null", () => {
    const row: EventRequestRow = {
      event_request_id: 1,
      event_name: "Draft",
      description: null,
      purpose: null,
      preferred_date: null,
      preferred_start_time: null,
      preferred_end_time: null,
      expected_attendance: null,
      venue_requirements: null,
      room_layout_preferences: null,
      accessibility_needs: null,
      equipment_requirements: null,
      registration_requirements: null,
      general_programme: null,
      other_special_arrangements: null,
      status: "Draft",
      decision_record: null,
      requesting_user_account_id: 2,
      assigned_coordinator_user_account_id: null,
      client_organisation_id: 1,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    };

    expect(toDomain(row).assignedCoordinatorUserAccountId).toBeNull();
  });
});
