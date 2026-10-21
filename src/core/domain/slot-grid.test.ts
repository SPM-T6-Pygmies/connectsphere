import { describe, expect, it } from "vitest";

import { joinSlotCodes, slotCodeRange, slotCodesFor } from "./slot-grid";

const at = (start: string, end: string) => ({
  start: Number(start.slice(0, 2)) * 60 + Number(start.slice(3)),
  end: Number(end.slice(0, 2)) * 60 + Number(end.slice(3)),
});

describe("slotCodeRange (SPM-321, SPM-331)", () => {
  it("gives AM, PM and Night the hours the slot table has", () => {
    expect(slotCodeRange("AM")).toEqual(at("07:00", "12:00"));
    expect(slotCodeRange("PM")).toEqual(at("13:00", "18:00"));
    expect(slotCodeRange("Night")).toEqual(at("19:00", "24:00"));
  });

  it("gives a 15-minute code its quarter hour, the first and last of the day included", () => {
    expect(slotCodeRange("0")).toEqual(at("00:00", "00:15"));
    expect(slotCodeRange("28")).toEqual(at("07:00", "07:15"));
    expect(slotCodeRange("95")).toEqual(at("23:45", "24:00"));
  });

  it("agrees that AM, PM and Night are the 15-minute codes the conversion maps them to", () => {
    expect(joinSlotCodes(Array.from({ length: 20 }, (_, i) => String(28 + i)))).toEqual([slotCodeRange("AM")]);
    expect(joinSlotCodes(Array.from({ length: 20 }, (_, i) => String(52 + i)))).toEqual([slotCodeRange("PM")]);
    expect(joinSlotCodes(Array.from({ length: 20 }, (_, i) => String(76 + i)))).toEqual([slotCodeRange("Night")]);
  });

  it.each(["96", "-1", "1.5", "07", "", "am", "Evening"])("refuses the code %j, which the slot table does not have", (code) => {
    expect(() => slotCodeRange(code)).toThrow(/Unknown slot code/);
  });
});

describe("slotCodesFor (SPM-321)", () => {
  it("covers 09:00 to 11:30 with codes 36 to 45", () => {
    expect(slotCodesFor(at("09:00", "11:30"))).toEqual(["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"]);
  });

  it("covers one quarter hour with one code, and the whole day with 96", () => {
    expect(slotCodesFor(at("00:00", "00:15"))).toEqual(["0"]);
    expect(slotCodesFor(at("00:00", "24:00"))).toHaveLength(96);
  });

  it("ends the last code at 24:00", () => {
    expect(slotCodesFor(at("23:00", "24:00"))).toEqual(["92", "93", "94", "95"]);
  });

  it("refuses a range off the grid, empty, backwards or past the day", () => {
    expect(() => slotCodesFor({ start: 610, end: 720 })).toThrow(/not on the 15-minute grid/);
    expect(() => slotCodesFor(at("10:00", "10:00"))).toThrow(/not a span of one day/);
    expect(() => slotCodesFor(at("12:00", "10:00"))).toThrow(/not a span of one day/);
    expect(() => slotCodesFor({ start: 1380, end: 1500 })).toThrow(/not a span of one day/);
  });
});

describe("joinSlotCodes (SPM-321)", () => {
  it("joins slots that touch into one span and keeps a gap between spans", () => {
    expect(joinSlotCodes(["36", "37", "38", "44", "45"])).toEqual([at("09:00", "09:45"), at("11:00", "11:30")]);
  });

  it("joins whatever order the codes come in", () => {
    expect(joinSlotCodes(["38", "36", "37"])).toEqual([at("09:00", "09:45")]);
  });

  it("counts a slot inside another once", () => {
    expect(joinSlotCodes(["PM", "60", "72"])).toEqual([at("13:00", "18:15")]);
  });

  it("is empty for no slots", () => {
    expect(joinSlotCodes([])).toEqual([]);
  });
});
