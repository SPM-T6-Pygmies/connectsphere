import { describe, expect, it } from "vitest";
import { InvalidEventFacilitiesError } from "./errors";
import { chooseRequiredFacilities, eventFacilitiesEditable } from "./event-facilities";

describe("chooseRequiredFacilities (SPM-247)", () => {
  it("stores the chosen facilities as the venue's list is stored", () => {
    expect(chooseRequiredFacilities(["Wi-Fi", "Catering area"])).toBe("Wi-Fi, Catering area");
  });

  it("puts them in the facility list's order, whatever order they were ticked in", () => {
    expect(chooseRequiredFacilities(["Video-conferencing", "Wi-Fi"])).toBe("Wi-Fi, Video-conferencing");
  });

  it("accepts every facility on the list", () => {
    expect(chooseRequiredFacilities(["Wi-Fi", "Breakout rooms", "Catering area", "Video-conferencing"])).toBe(
      "Wi-Fi, Breakout rooms, Catering area, Video-conferencing",
    );
  });

  it("counts a facility ticked twice once", () => {
    expect(chooseRequiredFacilities(["Wi-Fi", "Wi-Fi"])).toBe("Wi-Fi");
  });

  it("trims what it is given and ignores blanks", () => {
    expect(chooseRequiredFacilities(["  Wi-Fi ", ""])).toBe("Wi-Fi");
  });

  it("stores nothing when none is needed, so a need can be cleared", () => {
    expect(chooseRequiredFacilities([])).toBeNull();
  });

  it("refuses a value that is not on the facility list, naming it", () => {
    expect(() => chooseRequiredFacilities(["Wi-Fi", "Trampoline"])).toThrow(InvalidEventFacilitiesError);
    expect(() => chooseRequiredFacilities(["Trampoline"])).toThrow(/Trampoline is not an option/);
  });

  it("refuses the old equipment values that left the list", () => {
    expect(() => chooseRequiredFacilities(["Projector"])).toThrow(InvalidEventFacilitiesError);
    expect(() => chooseRequiredFacilities(["PA system"])).toThrow(InvalidEventFacilitiesError);
  });

  it("is case-sensitive, as the venue's own facilities are", () => {
    expect(() => chooseRequiredFacilities(["wi-fi"])).toThrow(InvalidEventFacilitiesError);
  });
});

describe("eventFacilitiesEditable (SPM-247)", () => {
  it.each(["Planning", "Blocked", "Confirmed"] as const)("is editable while the event is %s", (status) => {
    expect(eventFacilitiesEditable(status)).toBe(true);
  });

  it.each(["Completed", "Cancelled"] as const)("is read-only once the event is %s", (status) => {
    expect(eventFacilitiesEditable(status)).toBe(false);
  });
});
