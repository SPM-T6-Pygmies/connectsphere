import { describe, expect, it } from "vitest";

import { updateEventDetailsSchema } from "./update-event-details-schema";

const FORM = {
  eventId: "7",
  name: "Annual Summit",
  description: "",
  purpose: "",
  categoryType: "",
  programmeAgenda: "",
  specialArrangements: "",
  accessibilityRequirements: "",
  operationalNotes: "",
};

describe("updateEventDetailsSchema (SPM-49)", () => {
  it("passes the details through as typed, for the domain to judge", () => {
    expect(updateEventDetailsSchema.parse({ ...FORM, purpose: "  Alignment " })).toMatchObject({
      purpose: "  Alignment ",
    });
  });

  it("refuses a submission that names no event", () => {
    expect(updateEventDetailsSchema.safeParse({ ...FORM, eventId: " " }).success).toBe(false);
  });

  it("AC2: drops a significant field instead of passing it on", () => {
    const parsed = updateEventDetailsSchema.parse({ ...FORM, expectedAttendance: "500" });
    expect(parsed).not.toHaveProperty("expectedAttendance");
  });
});
