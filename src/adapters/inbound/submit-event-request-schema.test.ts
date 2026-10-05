import { describe, expect, it } from "vitest";

import { submitEventRequestSchema } from "./submit-event-request-schema";

/** What a browser actually posts: every field a string, blanks as "". */
const FORM = {
  eventRequestId: "",
  responsibleOrganiserId: "u-01",
  clientOrganisationId: "org-a",
  organiserTimeZone: "Asia/Singapore",
  eventName: "Founders' Day",
  description: "",
  purpose: "",
  preferredDate: "2026-11-04",
  preferredSlots: "AM, PM",
  expectedAttendance: "120",
  venueRequirements: "",
  roomLayoutPreferences: "",
  accessibilityNeeds: "",
  equipmentRequirements: "",
  registrationRequirements: "",
  generalProgramme: "",
  otherSpecialArrangements: "",
};

describe("submitEventRequestSchema (SPM-88)", () => {
  it("turns a filled-in form into the command the use case takes", () => {
    const parsed = submitEventRequestSchema.safeParse(FORM);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      eventName: "Founders' Day",
      preferredDate: "2026-11-04",
      preferredSlots: ["AM", "PM"],
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
      preferredSlots: "",
      expectedAttendance: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      eventName: "",
      preferredDate: null,
      preferredSlots: [],
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

  it("reads the slots the checkboxes post as one comma-separated value", () => {
    expect(submitEventRequestSchema.parse({ ...FORM, preferredSlots: "Night" }).preferredSlots).toEqual(
      ["Night"],
    );
  });

  it("rejects a slot that is not AM, PM or Night", () => {
    const parsed = submitEventRequestSchema.safeParse({ ...FORM, preferredSlots: "AM, Evening" });

    expect(parsed.success).toBe(false);
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

  it("treats a blank eventRequestId as a fresh request, not a draft to finish (SPM-38)", () => {
    expect(submitEventRequestSchema.parse(FORM).eventRequestId).toBeNull();
  });

  it("carries a draft's id through so submission can finish that same row (SPM-38)", () => {
    expect(
      submitEventRequestSchema.parse({ ...FORM, eventRequestId: "42" }).eventRequestId,
    ).toBe("42");
  });
});

describe("submitEventRequestSchema: accessibility and layout come from the venue lists (SPM-42)", () => {
  it("accepts several accessibility needs and a listed layout", () => {
    const parsed = submitEventRequestSchema.parse({
      ...FORM,
      accessibilityNeeds: "Step-free access, Hearing loop",
      roomLayoutPreferences: "Theatre",
    });

    expect(parsed.accessibilityNeeds).toBe("Step-free access, Hearing loop");
    expect(parsed.roomLayoutPreferences).toBe("Theatre");
  });

  it("accepts both left blank, as null -- neither is mandatory", () => {
    const parsed = submitEventRequestSchema.parse(FORM);

    expect(parsed.accessibilityNeeds).toBeNull();
    expect(parsed.roomLayoutPreferences).toBeNull();
  });

  it("refuses an accessibility need outside the list", () => {
    const parsed = submitEventRequestSchema.safeParse({ ...FORM, accessibilityNeeds: "Step-free access, Moat" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["accessibilityNeeds"]);
  });

  it("refuses a room layout outside the list", () => {
    const parsed = submitEventRequestSchema.safeParse({ ...FORM, roomLayoutPreferences: "Cabaret" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["roomLayoutPreferences"]);
  });

  it("refuses more than one room layout -- the request picks one", () => {
    const parsed = submitEventRequestSchema.safeParse({ ...FORM, roomLayoutPreferences: "Theatre, Banquet" });

    expect(parsed.success).toBe(false);
  });
});
