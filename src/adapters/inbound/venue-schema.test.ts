import { describe, expect, it } from "vitest";

import {
  createVenueSchema,
  updateVenueSchema,
  venueFieldErrors,
  venueFormValues,
} from "./venue-schema";

const valid = {
  location: " Marina Bay Hall ",
  facilities: "Projector",
  accessibility: "Step-free",
  operatingHoursStart: "08:30",
  operatingHoursEnd: "17:00",
  capacity: "300",
  bookingHorizonDays: "180",
  layouts: [
    { name: "Theatre", capacity: "200" },
    { name: "Banquet", capacity: "120" },
  ],
};

function errorsFor(input: unknown) {
  const parsed = createVenueSchema.safeParse(input);
  if (parsed.success) throw new Error("expected the form to be refused");
  return venueFieldErrors(parsed.error);
}

describe("createVenueSchema (SPM-146)", () => {
  it("parses a filled-in form: trimmed text, times as given, numeric capacities", () => {
    expect(createVenueSchema.parse(valid)).toEqual({
      location: "Marina Bay Hall",
      facilities: "Projector",
      accessibility: "Step-free",
      operatingHoursStart: "08:30",
      operatingHoursEnd: "17:00",
      capacity: 300,
      bookingHorizonDays: 180,
      layouts: [
        { name: "Theatre", capacity: 200 },
        { name: "Banquet", capacity: 120 },
      ],
    });
  });

  describe("flags each empty field against that field", () => {
    it("flags every field of an empty form", () => {
      const errors = errorsFor({
        location: "",
        facilities: "",
        accessibility: "",
        operatingHoursStart: "",
        operatingHoursEnd: "",
        capacity: "",
        bookingHorizonDays: "",
        layouts: [],
      });

      expect(Object.keys(errors).sort()).toEqual([
        "accessibility",
        "bookingHorizonDays",
        "capacity",
        "facilities",
        "layouts",
        "location",
        "operatingHoursEnd",
        "operatingHoursStart",
      ]);
    });

    it("flags a half-filled layout row on its own name or capacity", () => {
      const errors = errorsFor({
        ...valid,
        layouts: [
          { name: "Theatre", capacity: "" },
          { name: "", capacity: "20" },
        ],
      });

      expect(errors).toEqual({
        "layouts.0.capacity": "Enter this layout's capacity.",
        "layouts.1.name": "Enter a layout name.",
      });
    });

    it("flags a layout row left completely blank rather than ignoring it", () => {
      const errors = errorsFor({ ...valid, layouts: [...valid.layouts, { name: "", capacity: "" }] });

      expect(Object.keys(errors)).toEqual(["layouts.2.name", "layouts.2.capacity"]);
    });
  });

  it("refuses a time that is not a clock time, flagging that field", () => {
    expect(errorsFor({ ...valid, operatingHoursEnd: "5pm" })).toEqual({
      operatingHoursEnd: "Enter the closing time.",
    });
  });

  it("refuses a capacity that is not a whole number", () => {
    expect(errorsFor({ ...valid, layouts: [{ name: "Theatre", capacity: "12.5" }] })).toEqual({
      "layouts.0.capacity": "Enter the capacity as a whole number.",
    });
    expect(errorsFor({ ...valid, capacity: "many" }).capacity).toBeDefined();
  });

  it("refuses a booking horizon that is not a whole number", () => {
    expect(errorsFor({ ...valid, bookingHorizonDays: "2.5" }).bookingHorizonDays).toBeDefined();
  });
});

describe("updateVenueSchema (SPM-147)", () => {
  it("needs the venue being updated", () => {
    expect(updateVenueSchema.safeParse({ ...valid, venueId: "" }).success).toBe(false);
    expect(updateVenueSchema.safeParse({ ...valid, venueId: "7" }).success).toBe(true);
  });
});

describe("venueFormValues (SPM-146)", () => {
  it("pairs each layoutName with the layoutCapacity in the same position", () => {
    const formData = new FormData();
    formData.set("location", "Hall");
    formData.append("layoutName", "Theatre");
    formData.append("layoutCapacity", "200");
    formData.append("layoutName", "Banquet");
    formData.append("layoutCapacity", "120");

    expect(venueFormValues(formData).layouts).toEqual([
      { name: "Theatre", capacity: "200" },
      { name: "Banquet", capacity: "120" },
    ]);
  });
});
