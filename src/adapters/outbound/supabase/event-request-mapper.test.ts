import { describe, expect, it } from "vitest";

import {
  eventRequestDetails,
  eventRequestFixture,
} from "@/adapters/outbound/in-memory/event-request-fixture";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import {
  toAssignEventCoordinatorArgs,
  toDecideArgs,
  toDomain,
  toMyEventRequestSummary,
  toSaveArgs,
  toSubmitArgs,
  toWithdrawArgs,
  type EventRequestRow,
} from "./event-request-mapper";

describe("event request mapper", () => {
  it("maps every persisted operations field into the domain request", () => {
    const row: EventRequestRow = {
      event_request_id: 42,
      event_name: "Annual Client Forum",
      description: "Client briefing",
      purpose: "Share the annual plan",
      preferred_date: "2026-12-10",
      preferred_time: { start: "09:00", end: "10:00" },
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
        preferredStartTime: "09:00",
        preferredEndTime: "10:00",
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
      preferred_time: null,
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

  it("maps a coordinator assignment to the Operations RPC arguments", () => {
    const request = eventRequestFixture({
      id: eventRequestId("1"),
      assignedCoordinatorUserAccountId: userAccountId("9"),
    });

    expect(toAssignEventCoordinatorArgs(request)).toEqual({
      p_event_request_id: 1,
      p_event_coordinator_user_account_id: 9,
    });
  });

  it("maps a decision to the coordinator decision RPC arguments, naming who decided", () => {
    const request = eventRequestFixture({
      id: eventRequestId("12"),
      status: "Rejected",
      decisionRecord: "No expected attendance.",
      assignedCoordinatorUserAccountId: userAccountId("9"),
    });

    expect(toDecideArgs(request, userAccountId("9"))).toEqual({
      p_event_request_id: 12,
      p_coordinator_user_account_id: 9,
      p_decision: "Rejected",
      p_decision_record: "No expected attendance.",
    });
  });

  it("gives no decision arguments when either id was never one of ours", () => {
    const approved = { status: "Approved" as const };

    expect(
      toDecideArgs(eventRequestFixture({ ...approved, id: eventRequestId("request-1") }), userAccountId("9")),
    ).toBeNull();
    expect(
      toDecideArgs(eventRequestFixture({ ...approved, id: eventRequestId("12") }), userAccountId("coordinator-1")),
    ).toBeNull();
  });

  describe("toMyEventRequestSummary", () => {
    function summaryRow(overrides: Partial<EventRequestRow> = {}): EventRequestRow {
      return {
        event_request_id: 42,
        event_name: "Annual Client Forum",
        description: "Client briefing",
        purpose: null,
        preferred_date: "2026-12-10",
        preferred_time: null,
        expected_attendance: null,
        venue_requirements: null,
        room_layout_preferences: null,
        accessibility_needs: null,
        equipment_requirements: null,
        registration_requirements: null,
        general_programme: null,
        other_special_arrangements: null,
        status: "Submitted",
        decision_record: null,
        requesting_user_account_id: 7,
        assigned_coordinator_user_account_id: null,
        client_organisation_id: 3,
        created_at: "2026-09-01T01:00:00.000Z",
        updated_at: "2026-09-02T02:00:00.000Z",
        ...overrides,
      };
    }

    it("maps a submitted row to the list view, with submittedAt as ISO 8601", () => {
      expect(toMyEventRequestSummary(summaryRow())).toEqual({
        id: "42",
        eventName: "Annual Client Forum",
        status: "Submitted",
        preferredDate: "2026-12-10",
        description: "Client briefing",
        submittedAt: "2026-09-02T02:00:00.000Z",
      });
    });

    it("leaves submittedAt null for a request still in Draft", () => {
      expect(toMyEventRequestSummary(summaryRow({ status: "Draft" })).submittedAt).toBeNull();
    });

    it("refuses a status the event_request table should never hold", () => {
      expect(() => toMyEventRequestSummary(summaryRow({ status: "Archived" }))).toThrow(
        /Unknown event request status "Archived"/,
      );
    });
  });
});

describe("toWithdrawArgs (SPM-168)", () => {
  it("maps a withdrawal to the coordinator withdrawal RPC arguments, naming who withdrew it", () => {
    const request = eventRequestFixture({
      id: eventRequestId("12"),
      status: "Withdrawn",
      decisionRecord: "Organiser called to withdraw.",
      assignedCoordinatorUserAccountId: userAccountId("9"),
    });

    expect(toWithdrawArgs(request, userAccountId("9"))).toEqual({
      p_event_request_id: 12,
      p_coordinator_user_account_id: 9,
      p_note: "Organiser called to withdraw.",
    });
  });

  it("gives no withdrawal arguments when either id was never one of ours", () => {
    const withdrawn = { status: "Withdrawn" as const };

    expect(
      toWithdrawArgs(eventRequestFixture({ ...withdrawn, id: eventRequestId("request-1") }), userAccountId("9")),
    ).toBeNull();
    expect(
      toWithdrawArgs(eventRequestFixture({ ...withdrawn, id: eventRequestId("12") }), userAccountId("coordinator-1")),
    ).toBeNull();
  });
});

describe("event request preferred time (SPM-327)", () => {
  const row: EventRequestRow = {
    event_request_id: 5,
    event_name: "Founders' Day",
    description: null,
    purpose: null,
    preferred_date: "2026-11-04",
    expected_attendance: 80,
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

  it("reads a row whose query did not select preferred_time as having no time", () => {
    expect(toDomain(row).details).toMatchObject({ preferredStartTime: null, preferredEndTime: null });
  });

  it("reads the span preferred_time returns, 24:00 included", () => {
    expect(toDomain({ ...row, preferred_time: { start: "23:30", end: "24:00" } }).details).toMatchObject({
      preferredStartTime: "23:30",
      preferredEndTime: "24:00",
    });
  });

  it("sends the start and end time, and no slots, when submitting and saving", () => {
    const request = eventRequestFixture({
      id: eventRequestId("5"),
      details: eventRequestDetails({ preferredStartTime: "09:15", preferredEndTime: "10:00" }),
    });

    for (const args of [toSubmitArgs(request), toSaveArgs(request)]) {
      expect(args).toMatchObject({
        p_preferred_date: "2026-11-04",
        p_preferred_start_time: "09:15",
        p_preferred_end_time: "10:00",
      });
      expect(args).not.toHaveProperty("p_preferred_slots");
    }
  });

  it("sends no time for a draft without one", () => {
    const request = eventRequestFixture({
      id: eventRequestId("5"),
      details: eventRequestDetails({ preferredStartTime: null, preferredEndTime: null }),
    });

    expect(toSaveArgs(request)).toMatchObject({
      p_preferred_start_time: null,
      p_preferred_end_time: null,
    });
  });
});
