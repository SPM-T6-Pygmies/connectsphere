import { describe, expect, it } from "vitest";

import { InvalidVenueError } from "./errors";
import {
  bufferMinutes,
  buffersOf,
  checkBuffersChange,
  defineVenueBuffers,
  describeBuffers,
  BUFFER_OPTIONS,
  MAX_BUFFER_MINUTES,
} from "./venue-buffers";

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

  it.each([-15, -1, -150])("AC2: refuses %i minutes, which is negative", (minutes) => {
    expect(() => defineVenueBuffers({ setupMinutes: minutes, turnaroundMinutes: 0 })).toThrow(/0 or more/);
  });

  it("AC2: refuses a value that is not a whole number", () => {
    expect(() => defineVenueBuffers({ setupMinutes: 22.5, turnaroundMinutes: 0 })).toThrow(/whole number/);
    expect(() => defineVenueBuffers({ setupMinutes: Number.NaN, turnaroundMinutes: 0 })).toThrow(/whole number/);
  });

  it("AC2: accepts exactly 150 minutes and refuses a quarter hour more", () => {
    expect(MAX_BUFFER_MINUTES).toBe(150);
    expect(defineVenueBuffers({ setupMinutes: 150, turnaroundMinutes: 150 })).toEqual({
      setupMinutes: 150,
      turnaroundMinutes: 150,
    });
    expect(() => defineVenueBuffers({ setupMinutes: 165, turnaroundMinutes: 0 })).toThrow(/at most 150/);
    expect(() => defineVenueBuffers({ setupMinutes: 0, turnaroundMinutes: 165 })).toThrow(/at most 150/);
  });

  it("AC2: offers 0 to 150 in steps of 15 in the form, 11 choices", () => {
    expect(BUFFER_OPTIONS).toEqual([0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150]);
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

describe("checkBuffersChange (SPM-23)", () => {
  const UNDEFINED = { setupMinutes: null, turnaroundMinutes: null };
  const DEFINED = { setupMinutes: 30, turnaroundMinutes: 45 };

  it("AC1: lets a venue with none defined be given both", () => {
    expect(() => checkBuffersChange(UNDEFINED, DEFINED)).not.toThrow();
  });

  it("AC1: lets a venue with none defined be given 0 and 0, which locks it at 0", () => {
    expect(() => checkBuffersChange(UNDEFINED, { setupMinutes: 0, turnaroundMinutes: 0 })).not.toThrow();
  });

  it("lets a save that leaves an undefined venue undefined go through", () => {
    expect(() => checkBuffersChange(UNDEFINED, UNDEFINED)).not.toThrow();
  });

  it("AC3: lets a save that sends a defined venue's own values back go through", () => {
    expect(() => checkBuffersChange(DEFINED, { ...DEFINED })).not.toThrow();
  });

  it.each([
    ["the setup time", { setupMinutes: 45, turnaroundMinutes: 45 }],
    ["the turnaround time", { setupMinutes: 30, turnaroundMinutes: 60 }],
    ["both", { setupMinutes: 0, turnaroundMinutes: 0 }],
    ["clearing both", { setupMinutes: null, turnaroundMinutes: null }],
  ])("AC3: refuses changing %s once they are defined, and says they are locked", (_label, next) => {
    expect(() => checkBuffersChange(DEFINED, next)).toThrow(/locked/);
  });

  it("AC3: a venue defined as 0 and 0 is locked too", () => {
    expect(() =>
      checkBuffersChange({ setupMinutes: 0, turnaroundMinutes: 0 }, { setupMinutes: 15, turnaroundMinutes: 0 }),
    ).toThrow(/locked/);
  });

  it("AC3: treats a venue holding only one of the two as defined, so it is locked too", () => {
    expect(() => checkBuffersChange({ setupMinutes: 30, turnaroundMinutes: null }, DEFINED)).toThrow(/locked/);
    expect(() => checkBuffersChange({ setupMinutes: null, turnaroundMinutes: 45 }, UNDEFINED)).toThrow(/locked/);
  });

  it("AC3: names the field the refusal belongs to", () => {
    try {
      checkBuffersChange(DEFINED, { setupMinutes: 0, turnaroundMinutes: 0 });
    } catch (error) {
      expect((error as { field: string }).field).toBe("setupMinutes");
      return;
    }
    throw new Error("expected a refusal");
  });
});

describe("buffersOf (SPM-23)", () => {
  it("reads a venue's two values, a missing one as undefined", () => {
    expect(buffersOf({ setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({ setupMinutes: 30, turnaroundMinutes: 45 });
    expect(buffersOf({})).toEqual({ setupMinutes: null, turnaroundMinutes: null });
  });
});

describe("describeBuffers (SPM-23 AC10)", () => {
  it("AC10: reads a defined pair as setup and turnaround in minutes", () => {
    expect(describeBuffers({ setupMinutes: 30, turnaroundMinutes: 45 })).toBe("Setup 30 min · Turnaround 45 min");
  });

  it("AC10: reads a defined 0 and 0 as values, not as unset", () => {
    expect(describeBuffers({ setupMinutes: 0, turnaroundMinutes: 0 })).toBe("Setup 0 min · Turnaround 0 min");
  });

  it("AC10: reads a venue with none defined, or no fields at all, as Not set", () => {
    expect(describeBuffers({ setupMinutes: null, turnaroundMinutes: null })).toBe("Not set");
    expect(describeBuffers({})).toBe("Not set");
  });
});
