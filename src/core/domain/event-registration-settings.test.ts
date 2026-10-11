import { describe, expect, it } from "vitest";

import { InvalidRegistrationSettingsError } from "./errors";
import {
  chooseRegistrationSettings,
  eventRegistrationEditable,
  sameRegistrationSettings,
} from "./event-registration-settings";

describe("chooseRegistrationSettings (SPM-25)", () => {
  it("AC1: enables registration with an opening and closing date", () => {
    expect(chooseRegistrationSettings({ enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-20" })).toEqual({
      enabled: true,
      opensOn: "2026-11-01",
      closesOn: "2026-11-20",
    });
  });

  it("AC1: accepts a window that opens and closes on the same day", () => {
    expect(
      chooseRegistrationSettings({ enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-01" }),
    ).toMatchObject({ opensOn: "2026-11-01", closesOn: "2026-11-01" });
  });

  it("AC1: disables registration and keeps the dates, so it can be turned back on", () => {
    expect(chooseRegistrationSettings({ enabled: false, opensOn: "2026-11-01", closesOn: "2026-11-20" })).toEqual({
      enabled: false,
      opensOn: "2026-11-01",
      closesOn: "2026-11-20",
    });
  });

  it("AC1: disables registration with no dates at all", () => {
    expect(chooseRegistrationSettings({ enabled: false, opensOn: "", closesOn: null })).toEqual({
      enabled: false,
      opensOn: null,
      closesOn: null,
    });
  });

  it("trims the dates it is given", () => {
    expect(
      chooseRegistrationSettings({ enabled: true, opensOn: " 2026-11-01 ", closesOn: "2026-11-20 " }),
    ).toMatchObject({ opensOn: "2026-11-01", closesOn: "2026-11-20" });
  });

  it.each([
    ["no dates", null, null],
    ["no closing date", "2026-11-01", null],
    ["no opening date", null, "2026-11-20"],
    ["blank dates", " ", ""],
  ])("refuses to enable registration with %s", (_label, opensOn, closesOn) => {
    expect(() => chooseRegistrationSettings({ enabled: true, opensOn, closesOn })).toThrow(
      InvalidRegistrationSettingsError,
    );
  });

  it("refuses a window that opens the day after it closes", () => {
    expect(() =>
      chooseRegistrationSettings({ enabled: true, opensOn: "2026-11-21", closesOn: "2026-11-20" }),
    ).toThrow(/can't open \(2026-11-21\) after it closes \(2026-11-20\)/);
  });

  it("refuses a backwards window even while registration is off", () => {
    expect(() =>
      chooseRegistrationSettings({ enabled: false, opensOn: "2026-11-21", closesOn: "2026-11-20" }),
    ).toThrow(InvalidRegistrationSettingsError);
  });

  it.each(["2026-02-30", "01/11/2026", "soon"])("refuses %s, which is not a calendar date", (date) => {
    expect(() => chooseRegistrationSettings({ enabled: false, opensOn: date, closesOn: null })).toThrow(
      InvalidRegistrationSettingsError,
    );
  });
});

describe("eventRegistrationEditable (SPM-25)", () => {
  it.each(["Planning", "Blocked", "Confirmed"] as const)("is editable while the event is %s", (status) => {
    expect(eventRegistrationEditable(status)).toBe(true);
  });

  it.each(["Completed", "Cancelled"] as const)("is read-only once the event is %s", (status) => {
    expect(eventRegistrationEditable(status)).toBe(false);
  });
});

describe("sameRegistrationSettings (SPM-25)", () => {
  const SAVED = { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-20" };

  it("sees no change when every setting matches", () => {
    expect(sameRegistrationSettings(SAVED, { ...SAVED })).toBe(true);
  });

  it.each([
    ["the toggle", { enabled: false }],
    ["the opening date", { opensOn: "2026-11-02" }],
    ["the closing date", { closesOn: null }],
  ])("sees a change to %s", (_label, change) => {
    expect(sameRegistrationSettings(SAVED, { ...SAVED, ...change })).toBe(false);
  });
});
