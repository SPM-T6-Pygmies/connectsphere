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
  openingHours: [{ start: "07:00", end: "12:00" }, { start: "19:00", end: "24:00" }],
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
  it("parses a filled-in form: trimmed text, opening hours as given, numeric capacities", () => {
    expect(createVenueSchema.parse(valid)).toEqual({
      location: "Marina Bay Hall",
      facilities: "Wi-Fi",
      accessibility: "Step-free",
      openingHours: [{ start: "07:00", end: "12:00" }, { start: "19:00", end: "24:00" }],
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
        openingHours: [],
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
        "openingHours",
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

describe("opening hours on the venue form (SPM-333)", () => {
  it("flags a window left without a start or end on that row", () => {
    expect(errorsFor({ ...valid, openingHours: [valid.openingHours[0], { start: "", end: "24:00" }] })).toEqual({
      "openingHours.1.start": "Choose when this window opens.",
    });
  });

  it("refuses a time that is not HH:MM", () => {
    expect(errorsFor({ ...valid, openingHours: [{ start: "7am", end: "12:00" }] })).toEqual({
      "openingHours.0.start": "Enter the time as HH:MM, such as 07:00.",
    });
  });

  it("pairs each openingStart with the openingEnd in the same position", () => {
    const formData = new FormData();
    formData.append("openingStart", "07:00");
    formData.append("openingEnd", "12:00");
    formData.append("openingStart", "19:00");
    formData.append("openingEnd", "24:00");

    expect(venueFormValues(formData).openingHours).toEqual([
      { start: "07:00", end: "12:00" },
      { start: "19:00", end: "24:00" },
    ]);
  });

  it("reads no windows when none were posted", () => {
    expect(venueFormValues(new FormData()).openingHours).toEqual([]);
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
