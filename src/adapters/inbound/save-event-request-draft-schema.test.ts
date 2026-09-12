import { describe, expect, it } from "vitest";

import { saveEventRequestDraftSchema } from "./save-event-request-draft-schema";

/** What a browser actually posts: every field a string, blanks as "". */
const FORM = {
  eventRequestId: "",
  responsibleOrganiserId: "u-01",
  clientOrganisationId: "org-a",
  eventName: "Founders' Day",
  description: "",
  purpose: "",
  preferredDate: "",
  preferredStartTime: "",
  preferredEndTime: "",
  expectedAttendance: "",
  venueRequirements: "",
  roomLayoutPreferences: "",
  accessibilityNeeds: "",
  equipmentRequirements: "",
  registrationRequirements: "",
  generalProgramme: "",
  otherSpecialArrangements: "",
};

describe("saveEventRequestDraftSchema", () => {
  it("accepts a draft with nothing but a name filled in (AC1)", () => {
    const parsed = saveEventRequestDraftSchema.safeParse(FORM);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      eventName: "Founders' Day",
      preferredDate: null,
      preferredStartTime: null,
      expectedAttendance: null,
    });
  });

  it("accepts even a blank event name, leaving that verdict to the core", () => {
    expect(saveEventRequestDraftSchema.safeParse({ ...FORM, eventName: "" }).success).toBe(true);
  });

  it("treats a blank eventRequestId as a new draft, not one to update (SPM-38)", () => {
    expect(saveEventRequestDraftSchema.parse(FORM).eventRequestId).toBeNull();
  });

  it("carries an existing draft's id through so a second save updates it (AC2)", () => {
    expect(
      saveEventRequestDraftSchema.parse({ ...FORM, eventRequestId: "7" }).eventRequestId,
    ).toBe("7");
  });

  it("gives absent one representation: a blank box becomes null, never an empty string", () => {
    const parsed = saveEventRequestDraftSchema.parse(FORM);

    expect(parsed.description).toBeNull();
    expect(parsed.venueRequirements).toBeNull();
  });

  it.each(["-1", "12.5", "lots"])(
    "rejects %s as an attendance the store's own check would refuse",
    (value) => {
      expect(
        saveEventRequestDraftSchema.safeParse({ ...FORM, expectedAttendance: value }).success,
      ).toBe(false);
    },
  );

  it("rejects a date that is not a calendar date", () => {
    expect(
      saveEventRequestDraftSchema.safeParse({ ...FORM, preferredDate: "04/11/2026" }).success,
    ).toBe(false);
  });

  it("rejects a submission with no organiser or organisation attached", () => {
    expect(
      saveEventRequestDraftSchema.safeParse({ ...FORM, responsibleOrganiserId: "" }).success,
    ).toBe(false);
    expect(
      saveEventRequestDraftSchema.safeParse({ ...FORM, clientOrganisationId: "" }).success,
    ).toBe(false);
  });
});
