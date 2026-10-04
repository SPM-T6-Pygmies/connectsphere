import { describe, expect, it } from "vitest";

import { describeCapacity } from "./booking-capacity-message";

describe("describeCapacity (SPM-104)", () => {
  it("says the event fits and names the layout's own figure", () => {
    expect(
      describeCapacity({
        layout: "Theatre",
        capacity: 200,
        expectedAttendance: 100,
        withinCapacity: true,
      }),
    ).toEqual({
      tone: "ok",
      text: "Theatre seats 200 · fits the 100 expected",
    });
  });

  it("says by how many the event is over", () => {
    expect(
      describeCapacity({
        layout: "Boardroom",
        capacity: 20,
        expectedAttendance: 100,
        withinCapacity: false,
      }),
    ).toEqual({
      tone: "over",
      text: "Boardroom seats 20 · 100 expected, 80 over",
    });
  });

  it("treats exactly full as fitting", () => {
    expect(
      describeCapacity({
        layout: "Boardroom",
        capacity: 20,
        expectedAttendance: 20,
        withinCapacity: true,
      }).tone,
    ).toBe("ok");
  });

  it("is honest when the event has no expected attendance yet", () => {
    expect(
      describeCapacity({
        layout: "Theatre",
        capacity: 200,
        expectedAttendance: null,
        withinCapacity: null,
      }),
    ).toEqual({
      tone: "unknown",
      text: "Theatre seats 200 · no expected attendance on the event yet",
    });
  });

  it("is honest when the booking has no layout", () => {
    expect(
      describeCapacity({
        layout: null,
        capacity: null,
        expectedAttendance: 50,
        withinCapacity: null,
      }),
    ).toEqual({
      tone: "unknown",
      text: "No layout recorded, so no capacity to check",
    });
  });

  it("is honest when the venue no longer lists the layout", () => {
    expect(
      describeCapacity({
        layout: "Banquet",
        capacity: null,
        expectedAttendance: 50,
        withinCapacity: null,
      }),
    ).toEqual({
      tone: "unknown",
      text: "Banquet is no longer listed by this venue",
    });
  });
});
