import { describe, expect, it } from "vitest";

import {
  createVenueSchema,
  updateVenueSchema,
  venueFieldErrors,
  venueFormValues,
} from "./venue-schema";

const valid = {
  location: " Marina Bay Hall ",
  facilities: "Wi-Fi",
  accessibility: "Step-free",
  slots: ["AM", "PM"],
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
  it("parses a filled-in form: trimmed text, slots as given, numeric capacities", () => {
    expect(createVenueSchema.parse(valid)).toEqual({
      location: "Marina Bay Hall",
      facilities: "Wi-Fi",
      accessibility: "Step-free",
      slots: ["AM", "PM"],
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
        slots: [],
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
        "slots",
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

  it("refuses a slot that is not AM, PM or Night, flagging slots", () => {
    expect(errorsFor({ ...valid, slots: ["AM", "Evening"] })).toEqual({
      "slots.1": "Choose AM, PM or Night.",
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

  it("reads the comma-separated slots field as a list", () => {
    const formData = new FormData();
    formData.set("slots", "AM, Night");

    expect(venueFormValues(formData).slots).toEqual(["AM", "Night"]);
  });
});
