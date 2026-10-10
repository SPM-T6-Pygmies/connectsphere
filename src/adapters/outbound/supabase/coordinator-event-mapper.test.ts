import { describe, expect, it } from "vitest";

import {
  toAssignedEventSummary,
  toCoordinatorEvent,
  toCoordinatorEventDetails,
  toOrdinaryChangesPayload,
  type CoordinatorEventRecordRow,
  type CoordinatorEventRow,
} from "./coordinator-event-mapper";

describe("coordinator event mapper (SPM-137)", () => {
  const row: CoordinatorEventRow = {
    event_id: 5,
    event_request_id: 24,
    name: "Operations Roadmap Conference",
    status: "Planning",
    preferred_date: "2026-11-20",
    assigned_coordinator_user_account_id: 2,
    client_organisation_id: 1,
  };
  const organisationNames = new Map([[1, "Test Organisation"]]);

  it("carries the request the event was opened from, and names its client organisation", () => {
    expect(toAssignedEventSummary(row, organisationNames)).toEqual({
      id: "5",
      eventRequestId: "24",
      name: "Operations Roadmap Conference",
      clientOrganisationName: "Test Organisation",
      preferredDate: "2026-11-20",
      status: "Planning",
    });
  });

  it("maps a deleted request to no request, not to an id", () => {
    expect(
      toAssignedEventSummary({ ...row, event_request_id: null, preferred_date: null }, organisationNames)
        .eventRequestId,
    ).toBeNull();
  });

  it("leaves an organisation the name lookup did not return unnamed, rather than failing", () => {
    expect(toAssignedEventSummary(row, new Map()).clientOrganisationName).toBe("");
  });
});

describe("toCoordinatorEvent (SPM-186)", () => {
  const record: CoordinatorEventRecordRow = {
    event_id: 5,
    name: "Operations Roadmap Conference",
    description: null,
    status: "Planning",
    preferred_date: "2026-11-20",
    expected_attendance: 120,
    equipment_requirements: "Two projectors and a stage microphone.",
    client_organisation_id: 1,
    owning_organiser_user_account_id: 7,
    assigned_coordinator_user_account_id: 2,
  };

  it("AC6: carries the Organiser's stated equipment needs from the event row", () => {
    expect(toCoordinatorEvent(record).statedEquipmentNeeds).toBe(
      "Two projectors and a stage microphone.",
    );
  });

  it("AC6: maps an event with no stated equipment needs to none", () => {
    expect(toCoordinatorEvent({ ...record, equipment_requirements: null }).statedEquipmentNeeds).toBeNull();
  });
});

describe("coordinator event mapper -- ordinary details (SPM-49)", () => {
  it("AC1: reads the ordinary details from their columns", () => {
    const details = toCoordinatorEventDetails({
      event_id: 5,
      event_request_id: 24,
      name: "Roadmap Conference",
      status: "Planning",
      preferred_date: null,
      assigned_coordinator_user_account_id: 2,
      client_organisation_id: 1,
      expected_attendance: null,
      venue_requirements: null,
      room_layout_preference: null,
      accessibility_requirements: "Lift access",
      required_facilities: null,
      description: "Where the roadmap is shared",
      purpose: "Alignment",
      category_type: "Conference",
      programme_agenda: "Keynote, then panels",
      special_arrangements: "Halal catering",
      operational_notes: "Load-in at 7am",
    });

    expect(details).toMatchObject({
      name: "Roadmap Conference",
      description: "Where the roadmap is shared",
      purpose: "Alignment",
      categoryType: "Conference",
      programmeAgenda: "Keynote, then panels",
      specialArrangements: "Halal catering",
      accessibilityRequirements: "Lift access",
      operationalNotes: "Load-in at 7am",
    });
  });

  it("AC1: sends each change under its column name, a cleared one as null", () => {
    expect(
      toOrdinaryChangesPayload({ categoryType: "Workshop", operationalNotes: null, name: "Summit" }),
    ).toEqual({ category_type: "Workshop", operational_notes: null, name: "Summit" });
  });
});
