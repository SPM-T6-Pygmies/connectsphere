import { describe, expect, it } from "vitest";

import { InvalidVenueError } from "./errors";
import { bufferMinutes, defineVenueBuffers, MAX_BUFFER_MINUTES } from "./venue-buffers";

describe("defineVenueBuffers (SPM-23)", () => {
  it("AC1: keeps a setup and a turnaround time entered together", () => {
    expect(defineVenueBuffers({ setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({
      setupMinutes: 30,
      turnaroundMinutes: 45,
    });
  });

  it("AC1: accepts 0 for either or both, which is a defined value and not a missing one", () => {
    expect(defineVenueBuffers({ setupMinutes: 0, turnaroundMinutes: 0 })).toEqual({
      setupMinutes: 0,
      turnaroundMinutes: 0,
    });
    expect(defineVenueBuffers({ setupMinutes: 0, turnaroundMinutes: 15 })).toEqual({
      setupMinutes: 0,
      turnaroundMinutes: 15,
    });
  });

  it("AC4: leaves both undefined when neither is entered, as a venue that never had them", () => {
    expect(defineVenueBuffers({ setupMinutes: null, turnaroundMinutes: null })).toEqual({
      setupMinutes: null,
      turnaroundMinutes: null,
    });
    expect(defineVenueBuffers({})).toEqual({ setupMinutes: null, turnaroundMinutes: null });
  });

  it("AC1: refuses one entered without the other, naming the missing one", () => {
    expect(() => defineVenueBuffers({ setupMinutes: 30, turnaroundMinutes: null })).toThrow(
      "Enter the turnaround time too",
    );
    expect(() => defineVenueBuffers({ setupMinutes: null, turnaroundMinutes: 45 })).toThrow(
      "Enter the setup time too",
    );
  });

  it.each([1, 14, 16, 29, 44, 46, 1439])("AC2: refuses %i minutes, which is not a multiple of 15", (minutes) => {
    expect(() => defineVenueBuffers({ setupMinutes: minutes, turnaroundMinutes: 0 })).toThrow(
      /multiple of 15/,
    );
    expect(() => defineVenueBuffers({ setupMinutes: 0, turnaroundMinutes: minutes })).toThrow(
      /multiple of 15/,
    );
  });

  it.each([-15, -1, -1440])("AC2: refuses %i minutes, which is negative", (minutes) => {
    expect(() => defineVenueBuffers({ setupMinutes: minutes, turnaroundMinutes: 0 })).toThrow(/0 or more/);
  });

  it("AC2: refuses a value that is not a whole number", () => {
    expect(() => defineVenueBuffers({ setupMinutes: 22.5, turnaroundMinutes: 0 })).toThrow(/whole number/);
    expect(() => defineVenueBuffers({ setupMinutes: Number.NaN, turnaroundMinutes: 0 })).toThrow(/whole number/);
  });

  it("AC2: accepts exactly 24 hours and refuses a quarter hour more", () => {
    expect(MAX_BUFFER_MINUTES).toBe(1440);
    expect(defineVenueBuffers({ setupMinutes: 1440, turnaroundMinutes: 1440 })).toEqual({
      setupMinutes: 1440,
      turnaroundMinutes: 1440,
    });
    expect(() => defineVenueBuffers({ setupMinutes: 1455, turnaroundMinutes: 0 })).toThrow(/at most 1440/);
    expect(() => defineVenueBuffers({ setupMinutes: 0, turnaroundMinutes: 1455 })).toThrow(/at most 1440/);
  });

  it("names the field the problem is on, so the form can show it beside the right box", () => {
    const refusal = (input: { setupMinutes: number; turnaroundMinutes: number }) => {
      try {
        defineVenueBuffers(input);
      } catch (error) {
        return error as InvalidVenueError;
      }
      throw new Error("expected a refusal");
    };

    expect(refusal({ setupMinutes: 10, turnaroundMinutes: 0 }).field).toBe("setupMinutes");
    expect(refusal({ setupMinutes: 0, turnaroundMinutes: 10 }).field).toBe("turnaroundMinutes");
  });
});

describe("bufferMinutes (SPM-23)", () => {
  it("AC4: counts an undefined value as 0 minutes", () => {
    expect(bufferMinutes({ setupMinutes: null, turnaroundMinutes: null })).toEqual({ setup: 0, turnaround: 0 });
    expect(bufferMinutes({})).toEqual({ setup: 0, turnaround: 0 });
  });

  it("uses the venue's own values when they are defined", () => {
    expect(bufferMinutes({ setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({ setup: 30, turnaround: 45 });
  });
});
