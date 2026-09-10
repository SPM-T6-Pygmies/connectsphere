import { describe, expect, it } from "vitest";

import { submitEventRequestSchema } from "./submit-event-request-schema";

/** What a browser actually posts: every field a string, blanks as "". */
const FORM = {
  responsibleOrganiserId: "u-01",
  clientOrganisationId: "org-a",
  organiserTimeZone: "Asia/Singapore",
  eventName: "Founders' Day",
  description: "",
  purpose: "",
  preferredDate: "2026-11-04",
  preferredStartTime: "2026-11-04T09:00",
  preferredEndTime: "2026-11-04T17:00",
  expectedAttendance: "120",
  venueRequirements: "",
  roomLayoutPreferences: "",
  accessibilityNeeds: "",
  equipmentRequirements: "",
  registrationRequirements: "",
  generalProgramme: "",
  otherSpecialArrangements: "",
};

describe("submitEventRequestSchema", () => {
  it("turns a filled-in form into the command the use case takes", () => {
    const parsed = submitEventRequestSchema.safeParse(FORM);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      eventName: "Founders' Day",
      preferredDate: "2026-11-04",
      preferredStartTime: "2026-11-04T09:00",
      preferredEndTime: "2026-11-04T17:00",
      expectedAttendance: 120,
    });
  });

  it("gives absent one representation: a blank box becomes null, never an empty string", () => {
    const parsed = submitEventRequestSchema.parse(FORM);

    expect(parsed.description).toBeNull();
    expect(parsed.venueRequirements).toBeNull();
    expect(parsed.otherSpecialArrangements).toBeNull();
  });

  it("trims, so a space-bar answer is not mistaken for a filled field", () => {
    const parsed = submitEventRequestSchema.parse({ ...FORM, purpose: "   " });

    expect(parsed.purpose).toBeNull();
  });

  /**
   * The boundary checks shape; the core checks completeness. If this ever
   * starts failing, the mandatory-field rule has leaked out of the domain and
   * now has two homes that can disagree (#72 is still open).
   */
  it("accepts a form missing its mandatory fields and leaves that verdict to the core", () => {
    const parsed = submitEventRequestSchema.safeParse({
      ...FORM,
      eventName: "",
      preferredDate: "",
      preferredStartTime: "",
      preferredEndTime: "",
      expectedAttendance: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      eventName: "",
      preferredDate: null,
      preferredStartTime: null,
      preferredEndTime: null,
      expectedAttendance: null,
    });
  });

  it("coerces the attendance a number input posts as a string", () => {
    expect(submitEventRequestSchema.parse({ ...FORM, expectedAttendance: "0" })).toMatchObject({
      expectedAttendance: 0,
    });
  });

  it.each(["-1", "12.5", "lots"])(
    "rejects %s as an attendance the store's own check would refuse",
    (value) => {
      const parsed = submitEventRequestSchema.safeParse({ ...FORM, expectedAttendance: value });

      expect(parsed.success).toBe(false);
    },
  );

  it("rejects a date that is not a calendar date", () => {
    const parsed = submitEventRequestSchema.safeParse({ ...FORM, preferredDate: "04/11/2026" });

    expect(parsed.success).toBe(false);
  });

  it("rejects a preferred time that is not a datetime-local value", () => {
    const parsed = submitEventRequestSchema.safeParse({
      ...FORM,
      preferredStartTime: "2026-11-04 09:00",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a preferred time with or without seconds", () => {
    expect(
      submitEventRequestSchema.safeParse({ ...FORM, preferredStartTime: "2026-11-04T09:00" })
        .success,
    ).toBe(true);
    expect(
      submitEventRequestSchema.safeParse({ ...FORM, preferredStartTime: "2026-11-04T09:00:00" })
        .success,
    ).toBe(true);
  });

  it("accepts the full ISO instant the form actually composes and posts", () => {
    const parsed = submitEventRequestSchema.safeParse({
      ...FORM,
      preferredStartTime: "2026-11-04T01:00:00.000Z",
      preferredEndTime: "2026-11-04T09:00:00.000+08:00",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a submission with no organiser or organisation attached", () => {
    expect(
      submitEventRequestSchema.safeParse({ ...FORM, responsibleOrganiserId: "" }).success,
    ).toBe(false);
    expect(
      submitEventRequestSchema.safeParse({ ...FORM, clientOrganisationId: "" }).success,
    ).toBe(false);
  });

  it("rejects a submission with no timezone attached", () => {
    expect(
      submitEventRequestSchema.safeParse({ ...FORM, organiserTimeZone: "" }).success,
    ).toBe(false);
  });

  it("rejects a timezone the runtime does not recognise", () => {
    expect(
      submitEventRequestSchema.safeParse({ ...FORM, organiserTimeZone: "Mars/Olympus_Mons" })
        .success,
    ).toBe(false);
  });
});
