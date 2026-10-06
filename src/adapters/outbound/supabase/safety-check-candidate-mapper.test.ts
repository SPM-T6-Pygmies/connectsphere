import { describe, expect, it } from "vitest";

import { NotSafetyOfficerError } from "@/core/domain/errors";

import {
  toSafetyCheckCandidate,
  toSafetyCheckCandidateError,
  type SafetyCheckCandidateRow,
} from "./safety-check-candidate-mapper";

const gala: SafetyCheckCandidateRow = {
  event_id: 7,
  event_name: "Founders' Gala Dinner",
  status: "Planning",
  preferred_date: "2026-12-12",
  expected_attendance: 120,
  bookings: [{ status: "Confirmed", venue_location: "Grand Ballroom" }],
  equipment_lines: [{ line_state: "Reserved", quantity_requested: 3, quantity_reserved: 3 }],
  checked: false,
};

describe("safety check candidate mapper (SPM-259)", () => {
  it("AC5: maps a row to its event, bookings and equipment lines", () => {
    expect(toSafetyCheckCandidate(gala)).toEqual({
      event: {
        id: "7",
        name: "Founders' Gala Dinner",
        status: "Planning",
        preferredDate: "2026-12-12",
        expectedAttendance: 120,
      },
      bookings: [{ status: "Confirmed", venueName: "Grand Ballroom" }],
      equipmentLines: [{ state: "Reserved", quantityRequested: 3, quantityReserved: 3 }],
      checked: false,
    });
  });

  it("SPM-260 AC6: maps whether a safety check has been recorded on the event", () => {
    expect(toSafetyCheckCandidate({ ...gala, checked: true }).checked).toBe(true);
  });

  it("AC2, AC5: maps an event with no date, no attendance figure and no equipment lines", () => {
    const mapped = toSafetyCheckCandidate({
      ...gala,
      preferred_date: null,
      expected_attendance: null,
      equipment_lines: [],
    });

    expect(mapped.event.preferredDate).toBeNull();
    expect(mapped.event.expectedAttendance).toBeNull();
    expect(mapped.equipmentLines).toEqual([]);
  });

  it("AC7: maps SQLSTATE CS050 to the not-a-Safety-Officer error", () => {
    expect(toSafetyCheckCandidateError({ code: "CS050" })).toBeInstanceOf(NotSafetyOfficerError);
  });

  it("AC7: leaves any other failure to the caller", () => {
    expect(toSafetyCheckCandidateError({ code: "CS040" })).toBeNull();
    expect(toSafetyCheckCandidateError({})).toBeNull();
  });
});
