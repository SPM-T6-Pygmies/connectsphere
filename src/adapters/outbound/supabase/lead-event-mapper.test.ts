import { describe, expect, it } from "vitest";

import {
  EventCoordinatorNotFoundError,
  EventNotFoundError,
  EventNotReassignableError,
  NotCoordinatorLeadError,
} from "@/core/domain/errors";

import { toLeadEvent, toLeadEventError, type LeadEventRow } from "./lead-event-mapper";

const row: LeadEventRow = {
  event_id: 9,
  event_request_id: 4,
  name: "Venue Safety Review",
  description: null,
  status: "Planning",
  preferred_date: "2026-10-14",
  expected_attendance: 40,
  equipment_requirements: null,
  client_organisation_id: 1,
  owning_organiser_user_account_id: 6,
  assigned_coordinator_user_account_id: 2,
};

describe("toLeadEventError (SPM-256)", () => {
  it("maps SQLSTATE CS060 to the not-a-Lead error", () => {
    expect(toLeadEventError({ code: "CS060" })).toBeInstanceOf(NotCoordinatorLeadError);
  });

  it("leaves any other failure to the caller", () => {
    expect(toLeadEventError({ code: "CS050" })).toBeNull();
    expect(toLeadEventError({})).toBeNull();
  });
});

describe("toLeadEventError (SPM-257)", () => {
  it("maps CS061 to a missing event, CS062 to a status that cannot change hands, CS063 to a non-coordinator", () => {
    expect(toLeadEventError({ code: "CS061" }, { eventId: "9" })).toEqual(new EventNotFoundError("9"));
    expect(toLeadEventError({ code: "CS062", details: "Completed" })).toEqual(
      new EventNotReassignableError("Completed"),
    );
    expect(toLeadEventError({ code: "CS063" }, { coordinatorId: "3" })).toEqual(
      new EventCoordinatorNotFoundError("3"),
    );
  });
});

describe("toLeadEvent (SPM-257)", () => {
  it("carries the request the event was opened from", () => {
    expect(toLeadEvent(row)).toMatchObject({ id: "9", eventRequestId: "4", assignedCoordinatorUserAccountId: "2" });
  });

  it("refuses an event with no request", () => {
    expect(() => toLeadEvent({ ...row, event_request_id: null })).toThrow();
  });
});
