import type { ChangeRequestField } from "@/core/domain/change-request";

/**
 * What each change-request field is called on the Coordinator's screens. Kept
 * out of the client module so the server page can read it too.
 */
export const CHANGE_REQUEST_FIELD_LABELS: Record<ChangeRequestField, string> = {
  times: "Date and times",
  venue_requirements: "Venue requirements",
  expected_attendance: "Expected attendance",
  equipment_requirements: "Equipment requirements",
  registration: "Registration",
};
