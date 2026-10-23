import { describe, expect, it } from "vitest";

import { InvalidVenueError } from "./errors";
import type { BookingStatus } from "./booking";
import {
  bufferMinutes,
  buffersOf,
  checkBuffersChange,
  defineVenueBuffers,
  isUpcomingBooking,
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

describe("checkBuffersChange (SPM-23)", () => {
  const UNDEFINED = { setupMinutes: null, turnaroundMinutes: null };
  const DEFINED = { setupMinutes: 30, turnaroundMinutes: 45 };

  it("AC1: lets a venue with none defined be given both, when nothing upcoming would change", () => {
    expect(() => checkBuffersChange(UNDEFINED, DEFINED, false)).not.toThrow();
  });

  it("AC1: lets a venue with none defined be given 0 and 0, which locks it at 0", () => {
    expect(() => checkBuffersChange(UNDEFINED, { setupMinutes: 0, turnaroundMinutes: 0 }, false)).not.toThrow();
  });

  it("lets a save that leaves an undefined venue undefined go through, whatever is booked", () => {
    expect(() => checkBuffersChange(UNDEFINED, UNDEFINED, true)).not.toThrow();
  });

  it("AC3: lets a save that sends a defined venue's own values back go through", () => {
    expect(() => checkBuffersChange(DEFINED, { ...DEFINED }, true)).not.toThrow();
  });

  it.each([
    ["the setup time", { setupMinutes: 45, turnaroundMinutes: 45 }],
    ["the turnaround time", { setupMinutes: 30, turnaroundMinutes: 60 }],
    ["both", { setupMinutes: 0, turnaroundMinutes: 0 }],
    ["clearing both", { setupMinutes: null, turnaroundMinutes: null }],
  ])("AC3: refuses changing %s once they are defined, and says they are locked", (_label, next) => {
    expect(() => checkBuffersChange(DEFINED, next, false)).toThrow(/locked/);
  });

  it("AC3: a venue defined as 0 and 0 is locked too", () => {
    expect(() =>
      checkBuffersChange({ setupMinutes: 0, turnaroundMinutes: 0 }, { setupMinutes: 15, turnaroundMinutes: 0 }, false),
    ).toThrow(/locked/);
  });

  it("AC5: refuses defining them while a booking that has not ended exists, saying why", () => {
    expect(() => checkBuffersChange(UNDEFINED, DEFINED, true)).toThrow(/upcoming booking/);
  });

  it("AC5: names the field the refusal belongs to", () => {
    for (const [current, next, hasUpcoming] of [
      [DEFINED, { setupMinutes: 0, turnaroundMinutes: 0 }, false],
      [UNDEFINED, DEFINED, true],
    ] as const) {
      try {
        checkBuffersChange(current, next, hasUpcoming);
      } catch (error) {
        expect((error as { field: string }).field).toBe("setupMinutes");
        continue;
      }
      throw new Error("expected a refusal");
    }
  });
});

describe("buffersOf (SPM-23)", () => {
  it("reads a venue's two values, a missing one as undefined", () => {
    expect(buffersOf({ setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({ setupMinutes: 30, turnaroundMinutes: 45 });
    expect(buffersOf({})).toEqual({ setupMinutes: null, turnaroundMinutes: null });
  });
});

describe("isUpcomingBooking (SPM-23 AC5)", () => {
  const NOW = new Date("2026-12-14T10:00:00+08:00");
  const later = new Date("2026-12-14T12:00:00+08:00");
  const earlier = new Date("2026-12-13T12:00:00+08:00");
  const booking = (status: BookingStatus, endsAt: Date, holdExpiresAt: Date | null = null) => ({
    status,
    endsAt,
    holdExpiresAt,
  });

  it.each(["Requested", "Confirmed"] as const)("counts a %s booking that has not ended", (status) => {
    expect(isUpcomingBooking(booking(status, later), NOW)).toBe(true);
  });

  it.each(["Requested", "Confirmed"] as const)("does not count a %s booking that ended yesterday", (status) => {
    expect(isUpcomingBooking(booking(status, earlier), NOW)).toBe(false);
  });

  it("counts a booking in progress and not one that ends this very minute", () => {
    expect(isUpcomingBooking(booking("Confirmed", new Date("2026-12-14T10:15:00+08:00")), NOW)).toBe(true);
    expect(isUpcomingBooking(booking("Confirmed", NOW), NOW)).toBe(false);
  });

  it("counts a Tentative Hold that has not lapsed, and not one that has", () => {
    expect(isUpcomingBooking(booking("Tentative Hold", later, new Date("2026-12-15T10:00:00+08:00")), NOW)).toBe(true);
    expect(isUpcomingBooking(booking("Tentative Hold", later, new Date("2026-12-14T09:00:00+08:00")), NOW)).toBe(false);
  });

  it.each(["Rejected", "Released", "Cancelled", "Expired"] as const)("never counts a %s booking", (status) => {
    expect(isUpcomingBooking(booking(status, later), NOW)).toBe(false);
  });
});
