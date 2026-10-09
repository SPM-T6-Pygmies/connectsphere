import { describe, expect, it } from "vitest";
import { venueId, type Venue } from "./venue";
import { checkVenueSuitability, type EventNeeds } from "./venue-suitability";

const studio: Venue = {
  id: venueId("studio"),
  location: "Studio",
  facilities: "Wi-Fi, Video-conferencing",
  accessibility: "Step-free access",
  slots: ["AM", "PM"],
  capacity: 60,
  bookingHorizonDays: 60,
  layouts: [{ name: "Theatre", capacity: 60 }],
};

const mainHall: Venue = {
  ...studio,
  id: venueId("main-hall"),
  location: "Main Hall",
  facilities: "Wi-Fi, Catering area",
  accessibility: "Step-free access, Hearing loop",
  capacity: 300,
  layouts: [
    { name: "Theatre", capacity: 300 },
    { name: "Banquet", capacity: 180 },
  ],
};

const noNeeds: EventNeeds = {
  expectedAttendance: 50,
  preferredLayout: "Theatre",
  accessibilityNeeds: null,
  requiredFacilities: null,
};

function row(result: ReturnType<typeof checkVenueSuitability>, check: string) {
  const found = result.rows.find((candidate) => candidate.check === check);
  if (!found) throw new Error(`no ${check} row`);
  return found;
}

describe("checkVenueSuitability (SPM-246)", () => {
  describe("layout", () => {
    it("passes when the venue offers the preferred layout", () => {
      const result = checkVenueSuitability(studio, "Theatre", noNeeds);
      expect(row(result, "layout")).toMatchObject({ status: "pass", detail: "Offers Theatre" });
    });

    it("fails, naming the layout, when the venue does not offer it", () => {
      const result = checkVenueSuitability(studio, null, { ...noNeeds, preferredLayout: "Banquet" });
      expect(row(result, "layout")).toMatchObject({ status: "fail", detail: "Doesn't offer Banquet" });
    });

    it("is not stated, with neither pass nor fail, when the event has no preferred layout", () => {
      const result = checkVenueSuitability(studio, "Theatre", { ...noNeeds, preferredLayout: null });
      expect(row(result, "layout")).toMatchObject({ status: "unknown", detail: "Not stated" });
    });
  });

  describe("capacity", () => {
    const attend = (expectedAttendance: number | null) => ({ ...noNeeds, expectedAttendance });

    it("passes just below the seats of the layout", () => {
      expect(row(checkVenueSuitability(studio, "Theatre", attend(59)), "capacity").status).toBe("pass");
    });

    it("passes at exactly the seats", () => {
      expect(row(checkVenueSuitability(studio, "Theatre", attend(60)), "capacity").status).toBe("pass");
    });

    it("fails one above the seats, saying how many over", () => {
      expect(row(checkVenueSuitability(studio, "Theatre", attend(61)), "capacity")).toMatchObject({
        status: "fail",
        detail: "Theatre seats 60, 1 over",
      });
    });

    it("compares with the layout being booked, never the venue-wide capacity", () => {
      // Main Hall holds 300 in all, but Banquet seats 180.
      const result = checkVenueSuitability(mainHall, "Banquet", attend(200));
      expect(row(result, "capacity")).toMatchObject({ status: "fail", detail: "Banquet seats 180, 20 over" });
    });

    it("falls back to the preferred layout before one is picked", () => {
      const result = checkVenueSuitability(mainHall, null, { ...attend(250), preferredLayout: "Theatre" });
      expect(row(result, "capacity").status).toBe("pass");
    });

    it("is not known yet when the event has no expected attendance", () => {
      expect(row(checkVenueSuitability(studio, "Theatre", attend(null)), "capacity")).toMatchObject({
        status: "unknown",
        detail: "Not known yet",
      });
    });

    it("is not known yet when the venue no longer lists the layout", () => {
      expect(row(checkVenueSuitability(studio, "Banquet", attend(10)), "capacity")).toMatchObject({
        status: "unknown",
        detail: "Not known yet",
      });
    });

    it("is not known yet when there is no layout to compare with", () => {
      const result = checkVenueSuitability(studio, null, { ...attend(10), preferredLayout: null });
      expect(row(result, "capacity").status).toBe("unknown");
    });
  });

  describe.each([
    ["accessibility", "accessibilityNeeds", "Step-free access, Hearing loop"],
    ["facilities", "requiredFacilities", "Wi-Fi, Catering area"],
  ] as const)("%s", (check, field, venueHas) => {
    const venue: Venue = { ...studio, [check]: venueHas };
    const needing = (value: string | null): EventNeeds => ({ ...noNeeds, [field]: value });

    it("passes with 'None needed' when the event needs none", () => {
      expect(row(checkVenueSuitability(venue, "Theatre", needing(null)), check)).toMatchObject({
        status: "pass",
        detail: "None needed",
      });
    });

    it("passes when the venue has every item the event needs", () => {
      const [first, second] = venueHas.split(", ");
      expect(row(checkVenueSuitability(venue, "Theatre", needing(`${first}, ${second}`)), check).status).toBe("pass");
    });

    it("fails naming the one item the venue lacks", () => {
      const result = checkVenueSuitability(venue, "Theatre", needing("Lift access"));
      expect(row(result, check)).toMatchObject({ status: "fail", detail: "Missing: Lift access" });
    });

    it("fails naming every item the venue lacks", () => {
      const result = checkVenueSuitability(venue, "Theatre", needing("Lift access, Wheelchair seating"));
      expect(row(result, check)).toMatchObject({ status: "fail", detail: "Missing: Lift access, Wheelchair seating" });
    });

    it("fails for a venue that records none at all", () => {
      const bare: Venue = { ...studio, [check]: null };
      expect(row(checkVenueSuitability(bare, "Theatre", needing("Lift access")), check).status).toBe("fail");
    });
  });

  describe("overall", () => {
    it("is Suitable when every row passes", () => {
      const result = checkVenueSuitability(studio, "Theatre", {
        expectedAttendance: 50,
        preferredLayout: "Theatre",
        accessibilityNeeds: "Step-free access",
        requiredFacilities: "Video-conferencing",
      });
      expect(result.overall).toBe("Suitable");
      expect(result.failing).toEqual([]);
    });

    it("is Not suitable, naming the failing rows, when any row fails", () => {
      const result = checkVenueSuitability(mainHall, "Theatre", {
        ...noNeeds,
        requiredFacilities: "Video-conferencing",
        accessibilityNeeds: "Lift access",
      });
      expect(result.overall).toBe("Not suitable");
      expect(result.failing).toEqual(["accessibility", "facilities"]);
    });

    it("is Check incomplete when nothing fails but a row is unknown", () => {
      const result = checkVenueSuitability(studio, "Theatre", { ...noNeeds, expectedAttendance: null });
      expect(result.overall).toBe("Check incomplete");
      expect(result.failing).toEqual([]);
    });

    it("is Not suitable, not incomplete, when one row fails and another is unknown", () => {
      const result = checkVenueSuitability(studio, "Theatre", {
        ...noNeeds,
        expectedAttendance: null,
        requiredFacilities: "Catering area",
      });
      expect(result.overall).toBe("Not suitable");
    });

    it("gives a different verdict for the same venue when only the attendance changes", () => {
      const before = checkVenueSuitability(studio, "Theatre", { ...noNeeds, expectedAttendance: 50 });
      const after = checkVenueSuitability(studio, "Theatre", { ...noNeeds, expectedAttendance: 80 });
      expect(before.overall).toBe("Suitable");
      expect(after.overall).toBe("Not suitable");
      expect(row(after, "capacity").detail).toBe("Theatre seats 60, 20 over");
    });
  });
});
