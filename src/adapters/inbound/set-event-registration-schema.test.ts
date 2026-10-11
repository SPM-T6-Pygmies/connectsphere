import { describe, expect, it } from "vitest";

import { setEventRegistrationSchema } from "./set-event-registration-schema";

const FORM = { eventId: "7", enabled: "on", opensOn: "2026-11-01", closesOn: "2026-11-18" };

describe("setEventRegistrationSchema (SPM-25)", () => {
  it("AC1: reads a ticked toggle as enabled, with its dates", () => {
    expect(setEventRegistrationSchema.parse(FORM)).toEqual({
      eventId: "7",
      enabled: true,
      opensOn: "2026-11-01",
      closesOn: "2026-11-18",
    });
  });

  it("AC1: reads an unticked toggle, which posts nothing, as disabled", () => {
    expect(setEventRegistrationSchema.parse({ ...FORM, enabled: "" }).enabled).toBe(false);
  });

  it("reads blank dates as unset", () => {
    expect(setEventRegistrationSchema.parse({ ...FORM, opensOn: "", closesOn: " " })).toMatchObject({
      opensOn: null,
      closesOn: null,
    });
  });

  it("passes the dates through for the domain to judge", () => {
    expect(setEventRegistrationSchema.parse({ ...FORM, opensOn: "2026-02-30" }).opensOn).toBe("2026-02-30");
  });

  it("refuses a toggle value it does not recognise", () => {
    expect(setEventRegistrationSchema.safeParse({ ...FORM, enabled: "maybe" }).success).toBe(false);
  });

  it("refuses a submission that names no event", () => {
    expect(setEventRegistrationSchema.safeParse({ ...FORM, eventId: " " }).success).toBe(false);
  });
});
